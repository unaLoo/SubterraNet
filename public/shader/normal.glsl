#ifdef VERTEX_SHADER

precision highp float;

out vec2 texcoords;

vec4[] vertices = vec4[4](
    vec4(-1.0, -1.0, 0.0, 0.0),
    vec4(1.0, -1.0, 1.0, 0.0),
    vec4(-1.0, 1.0, 0.0, 1.0),
    vec4(1.0, 1.0, 1.0, 1.0)
);

void main() {

    vec4 attributes = vertices[gl_VertexID];

    gl_Position = vec4(attributes.xy, 0.0, 1.0);
    texcoords = attributes.zw;
}

#endif

#ifdef FRAGMENT_SHADER

precision highp int;
precision highp float;

in vec2 texcoords;

uniform sampler2D demTexture;

uniform vec2 e;
uniform float exaggeration;

out vec3 fragColor;

ivec2 uvCorrection(ivec2 uv, ivec2 dim) {
    return clamp(uv, ivec2(0), dim);
}

vec2 uvCorrection(vec2 uv, vec2 dim) {
    return clamp(uv, vec2(0.0), dim - vec2(1.0));
}

vec4 linearSampling(sampler2D texture, vec2 uv, vec2 dim) {
    vec4 tl = textureLod(texture, uv / dim, 0.0);
    vec4 tr = textureLod(texture, uvCorrection(uv + vec2(1.0, 0.0), dim) / dim, 0.0);
    vec4 bl = textureLod(texture, uvCorrection(uv + vec2(0.0, 1.0), dim) / dim, 0.0);
    vec4 br = textureLod(texture, uvCorrection(uv + vec2(1.0, 1.0), dim) / dim, 0.0);
    float mix_x = fract(uv.x);
    float mix_y = fract(uv.y);
    vec4 top = mix(tl, tr, mix_x);
    vec4 bottom = mix(bl, br, mix_x);
    return mix(top, bottom, mix_y);
}

float getElevation(vec2 uv, vec2 dim) {

    float elevation = exaggeration * mix(e.x, e.y, texture(demTexture, uv).r);
    return elevation <= 0.0 ? elevation : 0.0; 
    // return exaggeration * mix(e.x, e.y, linearSampling(demTexture, uv * dim, dim).r);
}

void main() {

    vec2 dim = vec2(textureSize(demTexture, 0));
    vec2 uv = texcoords;

    // float eM = getElevation(uv);
    // float eN = linearSampling(demTexture, )
    float eN = getElevation(texcoords + vec2(0.0, 1.0) / dim, dim);
    float eE = getElevation(texcoords + vec2(1.0, 0.0) / dim, dim);
    float eS = getElevation(texcoords + vec2(0.0, -1.0) / dim, dim);
    float eW = getElevation(texcoords + vec2(-1.0, 0.0) / dim, dim);

    vec3 dx = normalize(vec3(1.0, 0.0, eE - eW));
    vec3 dy = normalize(vec3(0.0, 1.0, eN - eS));

    vec3 normal = normalize(cross(dx, dy));

    fragColor = normal * 0.5 + 0.5;
}

#endif