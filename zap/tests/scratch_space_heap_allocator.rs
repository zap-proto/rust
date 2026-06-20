#![cfg(feature = "alloc")]

use zap::message;

#[test]
pub fn scratch_space_heap_allocator() {
    let mut buffer = zap::Word::allocate_zeroed_vec(200);
    {
        let allocator =
            message::ScratchSpaceHeapAllocator::new(zap::Word::words_to_bytes_mut(&mut buffer[..]));
        let mut msg = message::Builder::new(allocator);
        msg.set_root("hello world!").unwrap();

        let s: zap::text::Reader = msg.get_root_as_reader().unwrap();
        assert_eq!("hello world!", s);
    }

    for w in buffer {
        assert_eq!(w, zap::word(0, 0, 0, 0, 0, 0, 0, 0));
    }
}
