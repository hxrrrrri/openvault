pub fn reciprocal_rank(raw_rank: f64) -> f64 {
    1.0 / (1.0 + raw_rank.abs())
}
