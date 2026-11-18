shader_type canvas_item;

uniform sampler2D screen_tex : hint_screen_texture, filter_nearest;
uniform float levels : hint_range(4.0, 32.0) = 12.0;
uniform float strength : hint_range(0.0, 1.0) = 0.85;

const mat4 BAYER = mat4(
	vec4( 0.0,  8.0,  2.0, 10.0),
	vec4(12.0,  4.0, 14.0,  6.0),
	vec4( 3.0, 11.0,  1.0,  9.0),
	vec4(15.0,  7.0, 13.0,  5.0)
);

void fragment() {
	vec4 c = texture(screen_tex, SCREEN_UV);
	ivec2 p = ivec2(FRAGCOORD.xy) % 4;
	float bayer = BAYER[p.x][p.y] / 16.0 - 0.5;
	vec3 dithered = c.rgb + bayer * strength / levels;
	dithered = floor(dithered * levels + 0.5) / levels;
	// Soft autumn push — warm midtones, cool shadows
	dithered.r = clamp(dithered.r * 1.02, 0.0, 1.0);
	dithered.b = clamp(dithered.b * 0.98, 0.0, 1.0);
	COLOR = vec4(dithered, 1.0);
}
