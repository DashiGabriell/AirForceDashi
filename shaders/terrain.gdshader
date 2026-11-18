shader_type spatial;
render_mode cull_back, diffuse_lambert, specular_disabled, shadows_disabled;

uniform sampler2D height_tex : filter_linear, repeat_enable;
uniform sampler2D color_tex : filter_nearest, repeat_enable;
uniform float world_size = 20480.0;
uniform float height_scale = 180.0;
uniform float height_res = 512.0;
uniform float water_level = 0.0;
uniform vec3 sun_dir = vec3(0.55, 0.25, 0.35);
uniform float time_of_day = 1.0;

varying vec3 v_world;
varying float v_h;

float sample_h(vec2 uv) {
	return texture(height_tex, uv).r;
}

vec2 world_uv(vec2 xz) {
	return fract(xz / world_size + 0.5);
}

void vertex() {
	// Local sliding mesh: UVs come from world XZ so the map tiles under the jet.
	vec3 wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	vec2 uv = world_uv(wp.xz);
	float h = sample_h(uv) * height_scale;
	VERTEX.y = h;
	float texel = 1.0 / max(height_res, 1.0);
	float hx = sample_h(uv + vec2(texel, 0.0)) * height_scale;
	float hz = sample_h(uv + vec2(0.0, texel)) * height_scale;
	vec3 n = normalize(vec3(h - hx, texel * world_size, h - hz));
	NORMAL = n;
	v_world = vec3(wp.x, h, wp.z);
	v_h = h;
}

void fragment() {
	vec2 uv = world_uv(v_world.xz);
	vec3 base = texture(color_tex, uv).rgb;

	float terrace = floor(v_h * 0.08) * 0.01;
	base *= 1.0 - terrace;

	float NdotL = clamp(dot(NORMAL, normalize(sun_dir)), 0.0, 1.0);
	float shade = mix(0.35, 1.0, step(0.15, NdotL) * 0.55 + NdotL * 0.45);
	vec3 shadow_tint = vec3(0.48, 0.55, 0.68);
	vec3 light_tint = vec3(1.05, 0.98, 0.90);
	vec3 lit = mix(base * shadow_tint, base * light_tint, shade);

	// Haze vs camera (not world origin) so large maps stay coherent.
	float dist = length(v_world.xz - CAMERA_POSITION_WORLD.xz);
	float haze = smoothstep(1400.0, 4600.0, dist);
	vec3 sun_haze = vec3(0.78, 0.88, 0.98);
	vec3 far_haze = vec3(0.55, 0.72, 0.92);
	vec2 cam_flat = v_world.xz - CAMERA_POSITION_WORLD.xz;
	float toward_sun = clamp(dot(normalize(cam_flat), normalize(sun_dir.xz)), 0.0, 1.0);
	vec3 haze_col = mix(far_haze, sun_haze, toward_sun);
	lit = mix(lit, haze_col, haze * 0.55);

	ALBEDO = lit;
	ROUGHNESS = 1.0;
}
