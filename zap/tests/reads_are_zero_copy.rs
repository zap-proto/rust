// A read is a view that borrows the buffer: no parse pass, no per-field allocation.
//
// The claim is easy to assert and easy to lose, so this measures it two ways —
// a global allocator that counts every allocation across a burst of field reads,
// and pointer identity showing the bytes a reader hands back live inside the
// original buffer rather than in a copy of it.

use std::alloc::{GlobalAlloc, Layout, System};
use std::cell::Cell;

thread_local! {
    // Counted per thread: the test harness runs these tests in parallel, and a shared
    // counter would attribute a sibling test's allocations to this one's read loop.
    static ALLOCATIONS: Cell<usize> = const { Cell::new(0) };
}

struct Counting;

impl Counting {
    fn note() {
        // `try_with` so an allocation during thread teardown (after the local is gone)
        // is ignored rather than recursing into the allocator.
        let _ = ALLOCATIONS.try_with(|n| n.set(n.get() + 1));
    }
}

unsafe impl GlobalAlloc for Counting {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        Self::note();
        unsafe { System.alloc(layout) }
    }
    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        unsafe { System.dealloc(ptr, layout) }
    }
    unsafe fn realloc(&self, ptr: *mut u8, layout: Layout, new_size: usize) -> *mut u8 {
        Self::note();
        unsafe { System.realloc(ptr, layout, new_size) }
    }
}

#[global_allocator]
static ALLOCATOR: Counting = Counting;

fn allocations() -> usize {
    ALLOCATIONS.with(|n| n.get())
}

const WORDS: &[&str] = &["alpha", "beta", "gamma"];

fn written_message() -> Vec<u8> {
    let mut msg = zap::message::Builder::new_default();
    {
        let mut list = msg
            .init_root::<zap::any_pointer::Builder>()
            .initn_as::<zap::text_list::Builder>(WORDS.len() as u32);
        for (i, w) in WORDS.iter().enumerate() {
            list.set(i as u32, *w);
        }
    }
    let mut out = Vec::new();
    zap::serialize::write_message(&mut out, &msg).unwrap();
    out
}

#[test]
fn field_reads_allocate_nothing() {
    let buf = written_message();
    let mut slice: &[u8] = &buf[..];
    let reader = zap::serialize::read_message_from_flat_slice(
        &mut slice,
        zap::message::ReaderOptions::new(),
    )
    .unwrap();
    let list: zap::text_list::Reader = reader.get_root().unwrap();

    // Everything the loop touches is already allocated; only the reads are counted.
    let mut bytes_seen = 0usize;
    let before = allocations();
    for _ in 0..10_000 {
        for i in 0..list.len() {
            bytes_seen += list.get(i).unwrap().as_bytes().len();
        }
    }
    let counted = allocations() - before;

    assert_eq!(
        bytes_seen,
        10_000 * WORDS.iter().map(|w| w.len()).sum::<usize>()
    );
    assert_eq!(counted, 0, "reading fields allocated {counted} times");
}

#[test]
fn a_field_borrows_the_original_buffer() {
    let buf = written_message();
    let origin = buf.as_ptr() as usize;
    let end = origin + buf.len();

    let mut slice: &[u8] = &buf[..];
    let reader = zap::serialize::read_message_from_flat_slice(
        &mut slice,
        zap::message::ReaderOptions::new(),
    )
    .unwrap();
    let list: zap::text_list::Reader = reader.get_root().unwrap();

    for i in 0..list.len() {
        let field = list.get(i).unwrap();
        let at = field.as_bytes().as_ptr() as usize;
        assert!(
            (origin..end).contains(&at),
            "field {i} points outside the message buffer, so it was copied out"
        );
        assert_eq!(field.as_bytes(), WORDS[i as usize].as_bytes());
    }
}

#[test]
fn a_reader_is_a_view_not_an_owned_struct() {
    // A view is small enough to pass by value and carries no owning allocation, which
    // is why it is Copy. An owned struct built by copying fields out could be neither.
    fn assert_copy<T: Copy>() {}
    assert_copy::<zap::text_list::Reader>();
    assert_copy::<zap::text::Reader>();
    assert_copy::<zap::any_pointer::Reader>();
}
