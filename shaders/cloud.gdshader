shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_opaque, shadows_disabled;

uniform float day_factor : hint_range(0.0, 1.0) = 1.0;
uniform float density : hint_range(0.2, 1.5) = 0.7;
uniform vec3 sun_dir = vec3(0.55, 0.35, 0.4);

varying float v_shade;
varying vec3 v_normal;

void vertex() {
	// Soft puff — slight vertical breathe
	float bob = sin(TIME * 0.12 + NODE_POSITION_WORLD.x * 0.008 + NODE_POSITION_WORLD.z * 0.006) * 3.0;
	VERTEX += NORMAL * (0.02 * sin(TIME * 0.2 + VERTEX.x));
	VERTEX.y += bob;
	v_normal = NORMAL;
	float lit = dot(NORMAL, normalize(sun_dir)) * 0.5 + 0.5;
	v_shade = floor(lit * 5.0) / 5.0;
}

void fragment() {
	float day = clamp(day_factor, 0.0, 1.0);
	vec3 light_d = vec3(0.98, 0.99, 1.0);
	vec3 mid_d = vec3(0.78, 0.84, 0.92);
	vec3 dark_d = vec3(0.48, 0.56, 0.68);
	vec3 light_n = vec3(0.35, 0.38, 0.48);
	vec3 mid_n = vec3(0.22, 0.24, 0.32);
	vec3 dark_n = vec3(0.1, 0.11, 0.16);
	vec3 light = mix(light_n, light_d, day);
	vec3 mid = mix(mid_n, mid_d, day);
	vec3 dark = mix(dark_n, dark_d, day);

	vec3 col = mix(dark, mid, step(0.25, v_shade));
	col = mix(col, light, step(0.55, v_shade));
	// Soft edge falloff via fresnel-ish
	float edge = pow(1.0 - abs(dot(normalize(v_normal), vec3(0.0, 0.0, 1.0))), 1.5);
	ALBEDO = col;
	float dens = clamp(density, 0.25, 1.45);
	ALPHA = mix(0.55, 0.96, dens) * mix(0.92, 0.75, edge * 0.3);
}
