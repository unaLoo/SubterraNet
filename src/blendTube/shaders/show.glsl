#ifdef VERTEX_SHADER
precision highp float;

out vec2 texcoords;

vec4[] vertices = vec4[4](vec4(-1.0, -1.0, 0.0, 0.0), vec4(1.0, -1.0, 1.0, 0.0), vec4(-1.0, 1.0, 0.0, 1.0), vec4(1.0, 1.0, 1.0, 1.0));

void main() {

    vec4 attributes = vertices[gl_VertexID];

    gl_Position = vec4(attributes.xy, 0.0, 1.0);
    texcoords = attributes.zw;
}

#endif

#ifdef FRAGMENT_SHADER
precision highp int;
precision highp float;
precision highp usampler2D;
in vec2 texcoords;

uniform sampler2D debugTexture;
uniform sampler2D maskTexture;

out vec4 fragColor;

void main() {

    float flag = texture(maskTexture, texcoords).x;
    if(flag == 1.0) {
        vec4 M = texture(debugTexture, texcoords);
        float alpha = smoothstep(0.0, 1.0, M.a + 0.5);
        fragColor = vec4(M.rgb, alpha);
    } else {
        fragColor = vec4(0.0);
    }
}   

#endif