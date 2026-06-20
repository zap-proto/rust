use fill_random_values::Filler;
use zap::dynamic_value;

zap::generated_code!(pub mod addressbook_zap);
zap::generated_code!(pub mod fill_zap);

pub fn main() {
    let mut message = ::zap::message::Builder::new_default();
    let mut addressbook = message.init_root::<addressbook_zap::address_book::Builder>();

    let mut filler = Filler::new(::rand::rng(), 10);
    let dynamic: dynamic_value::Builder = addressbook.reborrow().into();
    filler.fill(dynamic.downcast()).unwrap();

    println!("{:#?}", addressbook.into_reader());
}
