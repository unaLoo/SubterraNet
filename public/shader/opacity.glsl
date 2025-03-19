#ifdef VERTEX_SHADER

precision highp float;

layout(location = 0) in vec4 vertex;

vec4[] vertices = vec4[4](
    vec4(-1.0, -1.0, 0.0, 0.0),
    vec4(1.0, -1.0, 1.0, 0.0),
    vec4(-1.0, 1.0, 0.0, 1.0),
    vec4(1.0, 1.0, 1.0, 1.0)
);

void main() {

    gl_Position = vec4(vertices[gl_VertexID].xy, 0.0, 1.0);
}

#endif

#ifdef FRAGMENT_SHADER

precision highp float;

uniform float alphaFactor;

out vec4 fragColor;

void main() {

    // fragColor = vec4(alpha * alphaFactor);
    fragColor = vec4(max(0.0, alphaFactor));
    // fragColor = vec4(0.5);
    // fragColor = vec4(0.12, 0.61, 0.84, 1.0);
}

#endif