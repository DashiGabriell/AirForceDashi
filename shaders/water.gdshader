shader_type spatial;
render_mode cull_disabled, diffuse_lambert, specular_schlick_ggx, shadows_disabled;

uniform float water_level = 0.0;
uniform vec3 sun_dir = vec3(0.55, 0.25, 0.35);
uniform sampler2D height_tex : filter_linear, repeat_enable;
uniform float world_size = 20480.0;
uniform float height_scale = 180.0;

varying vec3 v_world;

void vertex() {
	VERTEX.y = water_level;
	v_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

float land_h(vec2 xz) {
	vec2 uv = fract(xz / world_size + 0.5);
	return texture(height_tex, uv).r * height_scale;
}

void fragment() {
	vec2 xz = v_world.xz;
	float lh = land_h(xz);
	float depth = water_level - lh;

	// Depth bands: pale turquoise -> navy
	vec3 shallow = vec3(0.45, 0.78, 0.72);
	vec3 mid = vec3(0.18, 0.42, 0.58);
	vec3 deep = vec3(0.05, 0.12, 0.32);
	float d = clamp(depth / 40.0, 0.0, 1.0);
	vec3 col = mix(shallow, mid, smoothstep(0.0, 0.35, d));
	col = mix(col, deep, smoothstep(0.35, 1.0, d));

	// Shore foam
	float foam = 1.0 - smoothstep(0.0, 4.5, depth);
	float foam_wave = sin(xz.x * 0.35 + TIME * 2.2) * sin(xz.y * 0.28 - TIME * 1.7);
	foam *= step(0.15, foam_wave * 0.5 + 0.5);
	col = mix(col, vec3(0.92, 0.95, 0.98), foam * 0.85);

	// Glints
	float glint = pow(max(dot(normalize(vec3(0.0, 1.0, 0.0)), normalize(sun_dir)), 0.0), 80.0);
	float sparkle = step(0.97, fract(sin(dot(floor(xz * 0.5 + TIME), vec2(12.9898, 78.233))) * 43758.5453));
	col += vec3(1.0) * glint * 0.35 + vec3(0.9, 0.95, 1.0) * sparkle * 0.25;

	// Sky reflection bias at low angles handled via roughness/metallic look
	vec3 view = normalize(CAMERA_POSITION_WORLD - v_world);
	float fresnel = pow(1.0 - max(dot(view, vec3(0.0, 1.0, 0.0)), 0.0), 3.0);
	vec3 sky_refl = mix(vec3(0.40, 0.65, 0.92), vec3(0.75, 0.88, 0.98),
		clamp(dot(normalize(view.xz), normalize(sun_dir.xz)), 0.0, 1.0));
	col = mix(col, sky_refl, fresnel * 0.55);

	// Sun glitter path
	vec3 halfv = normalize(view + normalize(sun_dir));
	float glitter = pow(max(dot(vec3(0.0, 1.0, 0.0), halfv), 0.0), 120.0);
	col += vec3(1.0, 0.92, 0.7) * glitter * 0.8;

	ALBEDO = col;
	ROUGHNESS = 0.25;
	METALLIC = 0.15;
	ALPHA = 0.92;
}
