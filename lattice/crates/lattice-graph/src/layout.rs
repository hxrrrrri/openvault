pub fn circular_position(index: usize, total: usize, radius: f32) -> (f32, f32) {
    let total = total.max(1) as f32;
    let angle = (index as f32 / total) * std::f32::consts::TAU;
    (angle.cos() * radius, angle.sin() * radius)
}
