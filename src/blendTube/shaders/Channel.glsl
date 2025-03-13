
#ifdef VERTEX_SHADER

// #define PI 3.141592653589793
// #define RAD_TO_DEG 180.0 / PI
// #define DEG_TO_RAD PI / 180.0
// #define EarthRadius 6371008.8

layout(location = 0) in vec4 a_pos;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_uv;
layout(location = 3) in vec4 a_BIG_pos;
layout(location = 4) in float a_length;
layout(location = 5) in float a_curr_velocity;
layout(location = 6) in float a_next_velocity;

uniform mat4 u_matrix;
uniform float scaleRate;
uniform float u_time;

out vec3 v_normal;
out vec2 v_uv;
out float v_length;
out float v_curr_velocity;
out float v_next_velocity;
out float vz;

void main() {

    vec4 pos = mix(a_BIG_pos, a_pos, pow(clamp(scaleRate + 0.1, 0.0, 1.0), 0.1));
    // vec4 pos = a_pos;

    vec4 positionInClip = u_matrix * pos;
    gl_Position = positionInClip;

    v_normal = a_normal;
    v_uv = a_uv;
    v_length = a_length;

    v_curr_velocity = a_curr_velocity;
    v_next_velocity = a_next_velocity;
    vz = positionInClip.z / positionInClip.w;

}

#endif

#ifdef FRAGMENT_SHADER
precision mediump float;

in vec3 v_normal;
in vec2 v_uv;
in float v_length;
in float v_curr_velocity;
in float v_next_velocity;
in float vz;

uniform sampler2D u_ramp_texture;
uniform float u_time;
uniform float u_density;
uniform float u_threshold;
uniform float u_flow_speed;
uniform float u_max_flow;
uniform float u_color_darkness;

out vec4 fragColor;

const vec3 lightDirection = vec3(0.0, 1.0, 1.0);
const vec3 lightColor = vec3(0.47);

void main() {

    // vec3 baseColor = vec3(0.0, 0.13, 0.51);
    // vec3 baseColor = texture(u_texture, v_uv).rgb * 0.5;

    float diff = max(dot(normalize(v_normal), normalize(lightDirection)), 0.0) * 1.0;
    vec3 diffuse = diff * lightColor;

    // fragColor = vec4(baseColor + diffuse, 1.0);
    float velocity = mix(v_curr_velocity, v_next_velocity, fract(u_time));
    float currentLength = v_length * v_uv.x;
    float segmentValue = step(fract(currentLength / u_density - u_time * u_flow_speed * v_curr_velocity), u_threshold);
    vec2 rampUV = vec2(clamp(abs(velocity) / u_max_flow, 0.0, 1.0), 0.5);
    vec3 rampColor = texture(u_ramp_texture, rampUV).rgb;
    vec3 finalColor = mix(rampColor * u_color_darkness, rampColor, segmentValue);
    fragColor = vec4(finalColor + diffuse, 1.0);
}

#endif