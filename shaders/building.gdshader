shader_type spatial;
render_mode cull_back, diffuse_lambert, specular_disabled, shadows_disabled, depth_draw_opaque;

uniform float day_factor : hint_range(0.0, 1.0) = 1.0;
uniform vec3 sun_dir = vec3(0.55, 0.45, 0.35);

varying vec3 v_obj;
varying vec4 v_col;
varying vec3 v_n;

void vertex() {
	v_obj = VERTEX;
	v_col = COLOR;
	v_n = NORMAL;
}

void fragment() {
	vec3 base = v_col.rgb;
	float night = 1.0 - clamp(day_factor, 0.0, 1.0);
	// Quantize night so lit-window thresholds don't chatter as day_factor drifts.
	float night_q = floor(night * 16.0 + 0.001) / 16.0;
	float up = abs(dot(normalize(v_n), vec3(0.0, 1.0, 0.0)));
	vec3 emit = vec3(0.0);

	// Facade window grid on vertical walls (object space of unit building).
	if (up < 0.55) {
		float u = abs(v_n.x) > 0.5 ? v_obj.z : v_obj.x;
		float v = v_obj.y;
		float bay = fract((u + 0.5) * 5.5);
		float floor_y = fract((v + 0.5) * 9.0);
		float pane = step(0.16, bay) * step(bay, 0.84) * step(0.14, floor_y) * step(floor_y, 0.80);
		pane *= step(-0.38, v) * step(v, 0.40);
		float mull = step(0.07, bay) * step(bay, 0.93);
		pane *= mull;

		vec3 glass_day = vec3(0.18, 0.24, 0.32);
		vec3 glass_night = vec3(1.0, 0.84, 0.48);
		vec3 glass_cool = vec3(0.72, 0.86, 1.0);
		vec2 cell_id = floor(vec2((u + 0.5) * 5.5, (v + 0.5) * 9.0));
		float cell_h = fract(sin(dot(cell_id, vec2(12.9898, 78.233))) * 43758.5453);
		// Stable lit set: threshold only moves on night_q steps
		float lit_thresh = mix(0.72, 0.34, night_q);
		float lit = step(lit_thresh, cell_h);
		float cool = step(0.82, cell_h);
		vec3 glow = mix(glass_night, glass_cool, cool);
		vec3 glass = mix(glass_day, mix(glass_day * 0.45, glow, lit), night);
		base = mix(base, glass, pane * mix(0.55, 0.92, night));
		emit = glow * lit * pane * night * mix(1.2, 2.4, night);
	} else if (v_n.y > 0.5) {
		float tile = step(0.04, fract((v_obj.x + 0.5) * 6.0)) * step(0.04, fract((v_obj.z + 0.5) * 6.0));
		base *= mix(0.88, 1.0, tile);
	}

	float NdotL = clamp(dot(normalize(v_n), normalize(sun_dir)), 0.0, 1.0);
	float shade = mix(0.55, 1.0, NdotL);
	vec3 shadow_t = vec3(0.78, 0.84, 0.92);
	vec3 light_t = vec3(1.04, 1.01, 0.96);
	base = mix(base, base * vec3(1.08, 0.95, 0.82), night * 0.35);
	ALBEDO = mix(base * shadow_t, base * light_t, shade * mix(1.0, 0.35, night));
	EMISSION = emit;
	ROUGHNESS = 0.92;
	ALPHA = v_col.a;
}
