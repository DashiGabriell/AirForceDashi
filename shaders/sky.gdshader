shader_type sky;

uniform vec3 sun_dir = vec3(0.55, 0.25, 0.35);
uniform float sun_size = 0.035;
uniform float day_factor : hint_range(0.0, 1.0) = 1.0; // 1 = noon-ish day, 0 = deep night

void sky() {
	vec3 rd = EYEDIR;
	float h = rd.y * 0.5 + 0.5;
	float day = clamp(day_factor, 0.0, 1.0);
	float night = 1.0 - day;

	// Clear blue day — autumn stays on the ground, not in the sky
	vec3 day_zenith = vec3(0.28, 0.55, 0.92);
	vec3 day_mid = vec3(0.45, 0.72, 0.95);
	vec3 day_horizon_sun = vec3(0.72, 0.86, 0.98);
	vec3 day_horizon_away = vec3(0.62, 0.80, 0.96);

	// Night palette
	vec3 night_zenith = vec3(0.02, 0.03, 0.08);
	vec3 night_horizon = vec3(0.06, 0.09, 0.16);

	float toward = clamp(dot(normalize(rd.xz + vec2(0.0001)), normalize(sun_dir.xz + vec2(0.0001))), -1.0, 1.0) * 0.5 + 0.5;
	vec3 day_horizon = mix(day_horizon_away, day_horizon_sun, toward);
	vec3 day_col = mix(day_horizon, day_mid, smoothstep(0.0, 0.35, h));
	day_col = mix(day_col, day_zenith, smoothstep(0.25, 0.95, h));
	vec3 night_col = mix(night_horizon, night_zenith, smoothstep(0.0, 0.9, h));

	vec3 col = mix(night_col, day_col, day);

	// Soft golden rim only at the sun horizon (keeps autumn sun without lilac sky)
	float sun_h = sun_dir.y;
	float low_band = smoothstep(0.0, 0.22, h) * (1.0 - smoothstep(0.22, 0.48, h));
	float sun_side = pow(toward, 2.0);
	float golden = low_band * sun_side * smoothstep(-0.05, 0.35, sun_h) * day;
	col = mix(col, vec3(0.95, 0.78, 0.48), golden * 0.22);

	// Thin high cirrus streaks (cool white-blue)
	float streak = sin(rd.x * 18.0 + rd.z * 7.0) * sin(rd.x * 3.0 - rd.z * 11.0);
	streak = smoothstep(0.75, 0.95, streak) * smoothstep(0.35, 0.7, h);
	col += vec3(0.88, 0.93, 1.0) * streak * 0.10 * day;

	// Stars at night
	float stars = step(0.997, fract(sin(dot(floor(rd * 180.0), vec3(12.9898, 78.233, 45.164))) * 43758.5453));
	col += vec3(0.85, 0.9, 1.0) * stars * night * smoothstep(0.15, 0.5, h);

	// Sun / moon disc
	float sd = acos(clamp(dot(rd, normalize(sun_dir)), -1.0, 1.0));
	if (sun_dir.y > -0.05) {
		float sun = 1.0 - smoothstep(sun_size, sun_size * 1.8, sd);
		float glow = exp(-sd * 12.0) * 0.55 * day;
		col += vec3(1.0, 0.92, 0.7) * sun * day + vec3(1.0, 0.75, 0.4) * glow;
	} else {
		float md = acos(clamp(dot(rd, normalize(-sun_dir)), -1.0, 1.0));
		float moon = 1.0 - smoothstep(0.025, 0.04, md);
		col += vec3(0.75, 0.8, 0.9) * moon * night * 0.85;
	}

	COLOR = col;
}
