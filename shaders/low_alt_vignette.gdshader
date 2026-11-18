shader_type canvas_item;

uniform float intensity : hint_range(0.0, 1.0) = 0.0;
uniform float pulse : hint_range(0.0, 1.0) = 0.0;

void fragment() {
	vec2 uv = UV * 2.0 - 1.0;
	float r = length(uv * vec2(1.05, 1.15));
	float vignette = smoothstep(0.35, 1.25, r);
	float a = intensity * (0.55 + 0.45 * pulse) * vignette;
	// Soft red wash — stronger at edges, mild center tint
	vec3 red = vec3(0.72, 0.08, 0.06);
	COLOR = vec4(red, a * 0.85);
}
