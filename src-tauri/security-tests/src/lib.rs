//! Release-mode regression coverage for RUSTSEC-2024-0429.
//! This crate is only selected explicitly; it is not part of the desktop binary.

#[cfg(test)]
mod tests {
    use glib::prelude::*;

    #[test]
    fn string_iteration_preserves_utf8_and_empty_strings() {
        let values = ["幕灵", "", "🌸", "last"];
        let variant = values.to_variant();
        let mut iter = variant.array_iter_str().unwrap();
        assert_eq!(iter.len(), 4);
        assert_eq!(iter.next(), Some(values[0]));
        assert_eq!(iter.next_back(), Some(values[3]));
        assert_eq!(iter.next_back(), Some(values[2]));
        assert_eq!(iter.next(), Some(values[1]));
        assert_eq!(iter.next(), None);
        assert_eq!(iter.next_back(), None);
    }

    #[test]
    fn skipping_from_both_ends_returns_valid_strings() {
        let variant = ["zero", "one", "two", "three", "four", "five"].to_variant();
        let mut iter = variant.array_iter_str().unwrap();
        assert_eq!(iter.nth(1), Some("one"));
        assert_eq!(iter.nth_back(1), Some("four"));
        assert_eq!(iter.last(), Some("three"));
    }

    #[test]
    fn overflow_and_empty_iteration_are_exhausted() {
        let empty = Vec::<String>::new().to_variant();
        assert_eq!(empty.array_iter_str().unwrap().next(), None);
        assert_eq!(empty.array_iter_str().unwrap().next_back(), None);
        assert_eq!(empty.array_iter_str().unwrap().last(), None);
        let variant = ["one"].to_variant();
        assert_eq!(variant.array_iter_str().unwrap().nth(usize::MAX), None);
        assert_eq!(variant.array_iter_str().unwrap().nth_back(usize::MAX), None);
    }
}
