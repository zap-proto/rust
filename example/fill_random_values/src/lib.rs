use rand::distr::uniform::SampleUniform;
use rand::Rng;

use zap::introspect::TypeVariant;
use zap::schema;
use zap::{dynamic_struct, dynamic_value};

zap::generated_code!(pub mod fill_zap);

pub struct Filler<R: Rng> {
    rng: R,
    recursion_limit: u32,
}

fn get_range<T>(r: dynamic_struct::Reader) -> ::zap::Result<std::ops::RangeInclusive<T>>
where
    T: for<'a> ::zap::dynamic_value::DowncastReader<'a>,
{
    Ok(r.get_named("min")?.downcast::<T>()..=r.get_named("max")?.downcast::<T>())
}

fn set_from_range<T, R>(
    rng: &mut R,
    a: ::zap::schema::Annotation,
    mut builder: ::zap::dynamic_struct::Builder,
    field: ::zap::schema::Field,
) -> ::zap::Result<()>
where
    T: for<'a> ::zap::dynamic_value::DowncastReader<'a>
        + SampleUniform
        + PartialOrd
        + for<'a> Into<::zap::dynamic_value::Reader<'a>>,
    R: Rng,
{
    let x: T = rng.random_range(get_range::<T>(a.get_value()?.downcast())?);
    builder.set(field, x.into())
}

impl<R: Rng> Filler<R> {
    pub fn new(rng: R, recursion_limit: u32) -> Self {
        Self {
            rng,
            recursion_limit,
        }
    }

    fn random_enum_value(&mut self, e: schema::EnumSchema) -> ::zap::Result<dynamic_value::Enum> {
        let enumerants = e.get_enumerants()?;
        let idx = self.rng.random_range(0..enumerants.len());
        let value = enumerants.get(idx).get_ordinal();
        Ok(::zap::dynamic_value::Enum::new(value, e))
    }

    fn fill_text(&mut self, mut builder: ::zap::text::Builder) {
        builder.clear();
        for _ in 0..builder.len() {
            builder.push_ascii(self.rng.random_range(b'a'..=b'z'));
        }
    }

    fn fill_data(&mut self, builder: ::zap::data::Builder) {
        for b in builder {
            *b = self.rng.random();
        }
    }

    fn fill_field(
        &mut self,
        recursion_depth: u32,
        mut builder: ::zap::dynamic_struct::Builder,
        field: ::zap::schema::Field,
    ) -> ::zap::Result<()> {
        let annotations = field.get_annotations()?;
        for annotation in annotations {
            if annotation.get_id() == fill_zap::select_from::choices::ID {
                if let TypeVariant::List(element_type) = annotation.get_type().which() {
                    if !element_type.loose_equals(field.get_type()) {
                        return Err(::zap::Error::failed(
                            "choices annotation element type mismatch".into(),
                        ));
                    }
                } else {
                    return Err(::zap::Error::failed(
                        "choices annotation was not of List type".into(),
                    ));
                }
                let choices: zap::dynamic_list::Reader<'_> = annotation.get_value()?.downcast();
                let idx = self.rng.random_range(0..choices.len());
                return builder.set(field, choices.get(idx).unwrap());
            } else if annotation.get_id() == fill_zap::int8_range::ID {
                return set_from_range::<i8, R>(&mut self.rng, annotation, builder, field);
            } else if annotation.get_id() == fill_zap::int16_range::ID {
                return set_from_range::<i16, R>(&mut self.rng, annotation, builder, field);
            } else if annotation.get_id() == fill_zap::int32_range::ID {
                return set_from_range::<i32, R>(&mut self.rng, annotation, builder, field);
            } else if annotation.get_id() == fill_zap::int64_range::ID {
                return set_from_range::<i64, R>(&mut self.rng, annotation, builder, field);
            } else if annotation.get_id() == fill_zap::uint8_range::ID {
                return set_from_range::<u8, R>(&mut self.rng, annotation, builder, field);
            } else if annotation.get_id() == fill_zap::uint16_range::ID {
                return set_from_range::<u16, R>(&mut self.rng, annotation, builder, field);
            } else if annotation.get_id() == fill_zap::uint32_range::ID {
                return set_from_range::<u32, R>(&mut self.rng, annotation, builder, field);
            } else if annotation.get_id() == fill_zap::uint64_range::ID {
                return set_from_range::<u64, R>(&mut self.rng, annotation, builder, field);
            } else if annotation.get_id() == fill_zap::float32_range::ID {
                return set_from_range::<f32, R>(&mut self.rng, annotation, builder, field);
            } else if annotation.get_id() == fill_zap::float64_range::ID {
                return set_from_range::<f64, R>(&mut self.rng, annotation, builder, field);
            }
        }

        match field.get_type().which() {
            TypeVariant::Void => Ok(()),
            TypeVariant::Bool => builder.set(field, self.rng.random::<bool>().into()),
            TypeVariant::Int8 => builder.set(field, self.rng.random::<i8>().into()),
            TypeVariant::Int16 => builder.set(field, self.rng.random::<i16>().into()),
            TypeVariant::Int32 => builder.set(field, self.rng.random::<i32>().into()),
            TypeVariant::Int64 => builder.set(field, self.rng.random::<i64>().into()),
            TypeVariant::UInt8 => builder.set(field, self.rng.random::<u8>().into()),
            TypeVariant::UInt16 => builder.set(field, self.rng.random::<u16>().into()),
            TypeVariant::UInt32 => builder.set(field, self.rng.random::<u32>().into()),
            TypeVariant::UInt64 => builder.set(field, self.rng.random::<u64>().into()),
            TypeVariant::Float32 => builder.set(field, self.rng.random::<f32>().into()),
            TypeVariant::Float64 => builder.set(field, self.rng.random::<f64>().into()),
            TypeVariant::Text => {
                if annotations.find(fill_zap::phone_number::ID).is_some() {
                    builder.set(
                        field,
                        format!(
                            "{:03}-555-1{:03}",
                            self.rng.random_range(0..1000),
                            self.rng.random_range(0..1000)
                        )[..]
                            .into(),
                    )
                } else {
                    let len = self.rng.random_range(0..20);
                    self.fill_text(builder.initn(field, len)?.downcast());
                    Ok(())
                }
            }
            TypeVariant::Data => {
                let len = self.rng.random_range(0..20);
                self.fill_data(builder.initn(field, len)?.downcast());
                Ok(())
            }
            TypeVariant::Enum(e) => builder.set(field, self.random_enum_value(e.into())?.into()),
            TypeVariant::Struct(_) => {
                if recursion_depth < self.recursion_limit {
                    self.fill_struct(recursion_depth + 1, builder.init(field)?.downcast())
                } else {
                    Ok(())
                }
            }
            TypeVariant::List(_) => {
                let annotations = field.get_annotations()?;
                let len;
                if let Some(len_range) = annotations.find(fill_zap::length_range::ID) {
                    let len_range: dynamic_struct::Reader<'_> = len_range.get_value()?.downcast();
                    let min: u32 = len_range.get_named("min")?.downcast();
                    let max: u32 = len_range.get_named("max")?.downcast();
                    len = self.rng.random_range(min..=max);
                } else {
                    len = self.rng.random_range(0..10);
                }
                if recursion_depth < self.recursion_limit {
                    self.fill_list(recursion_depth + 1, builder.initn(field, len)?.downcast())
                } else {
                    Ok(())
                }
            }

            TypeVariant::AnyPointer => Ok(()),
            TypeVariant::Capability => Ok(()),
        }
    }

    fn fill_list_element(
        &mut self,
        recursion_depth: u32,
        mut builder: ::zap::dynamic_list::Builder,
        index: u32,
    ) -> ::zap::Result<()> {
        match builder.element_type().which() {
            TypeVariant::Void => Ok(()),
            TypeVariant::Bool => builder.set(index, self.rng.random::<bool>().into()),
            TypeVariant::Int8 => builder.set(index, self.rng.random::<i8>().into()),
            TypeVariant::Int16 => builder.set(index, self.rng.random::<i16>().into()),
            TypeVariant::Int32 => builder.set(index, self.rng.random::<i32>().into()),
            TypeVariant::Int64 => builder.set(index, self.rng.random::<i64>().into()),
            TypeVariant::UInt8 => builder.set(index, self.rng.random::<u8>().into()),
            TypeVariant::UInt16 => builder.set(index, self.rng.random::<u16>().into()),
            TypeVariant::UInt32 => builder.set(index, self.rng.random::<u32>().into()),
            TypeVariant::UInt64 => builder.set(index, self.rng.random::<u64>().into()),
            TypeVariant::Float32 => builder.set(index, self.rng.random::<f32>().into()),
            TypeVariant::Float64 => builder.set(index, self.rng.random::<f64>().into()),
            TypeVariant::Enum(e) => builder.set(index, self.random_enum_value(e.into())?.into()),
            TypeVariant::Text => {
                let len = self.rng.random_range(0..20);
                self.fill_text(builder.init(index, len)?.downcast());
                Ok(())
            }
            TypeVariant::Data => {
                let len = self.rng.random_range(0..20);
                self.fill_data(builder.init(index, len)?.downcast());
                Ok(())
            }
            TypeVariant::Struct(_) => {
                self.fill_struct(recursion_depth + 1, builder.get(index)?.downcast())
            }
            TypeVariant::List(_) => {
                self.fill_list(recursion_depth + 1, builder.get(index)?.downcast())
            }
            TypeVariant::AnyPointer => Ok(()),
            TypeVariant::Capability => Ok(()),
        }
    }

    fn fill_list(
        &mut self,
        recursion_depth: u32,
        mut builder: ::zap::dynamic_list::Builder,
    ) -> ::zap::Result<()> {
        for idx in 0..builder.len() {
            self.fill_list_element(recursion_depth, builder.reborrow(), idx)?;
        }
        Ok(())
    }

    fn fill_struct(
        &mut self,
        recursion_depth: u32,
        mut builder: ::zap::dynamic_struct::Builder,
    ) -> ::zap::Result<()> {
        let schema = builder.get_schema();
        let non_union_fields = schema.get_non_union_fields()?;
        for field in non_union_fields {
            if field.get_type().is_pointer_type() {
                // maybe decide not to touch the field.
            }
            self.fill_field(recursion_depth, builder.reborrow(), field)?;
        }

        let union_fields = schema.get_union_fields()?;
        if !union_fields.is_empty() {
            let disc = self.rng.random_range(0..union_fields.len());
            self.fill_field(recursion_depth, builder, union_fields.get(disc))?;
        }
        Ok(())
    }

    pub fn fill(&mut self, builder: ::zap::dynamic_struct::Builder) -> ::zap::Result<()> {
        self.fill_struct(0, builder)
    }
}
