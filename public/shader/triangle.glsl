#ifdef VERTEX_SHADER

precision highp float;

vec2[] vertices = vec2[3](
    vec2(-1.0, -1.0),
    vec2(1.0, -1.0),
    vec2(0.0, 1.0)
);

void main() {

    gl_Position = vec4(vertices[gl_VertexID], 0.0, 1.0);
}

#endif

#ifdef FRAGMENT_SHADER

precision highp float;

out vec4 fragColor;

void main() {

    fragColor = vec4(1.0, 1.0, 1.0, 0.0) -  vec4(1.0, 0.0, 0.0, 1.0);
}

#endif