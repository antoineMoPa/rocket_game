precision highp float;

varying vec2 UV;
uniform vec3 iResolution;
uniform vec2 renderBufferRatio;
uniform vec3 rocket_pos;
varying vec2 lastUV;
uniform float time;
uniform int pass;
uniform sampler2D pass0;
uniform sampler2D pass1;
uniform sampler2D pass2;
uniform sampler2D lastPass;
uniform float ratio;

#define PI 3.14159265359
#define PI2 6.28318

//PASSES=3

vec4 rocket(vec2 pos){
    vec4 col = vec4(0.0);
    
    // Clip (because otherwise a sine is repeated)
    if(pos.x < -0.5 || pos.x > 0.5){
        return col;
    }
    
    if(
      // Base parabolic shape
      pos.y + 0.02 * cos(12.0 * pos.y + 0.1) * pos.y < 0.5 - pow(3.88 * pos.x, 2.0) && pos.y > -0.1 
      ||
        // Lower rectangle
       ( pos.y < 0.0 && pos.y > -0.2 
            && 
                // Lower left arc
                (pos.x > -0.1 || distance(pos, vec2(-0.1,-0.1)) < 0.10) 
                // Lower right arc
            &&     (pos.x < 0.1  || distance(pos, vec2(0.1,-0.1)) < 0.10)
       )
      )
    {
        // Window
        if (
            distance(pos, vec2(0.0,0.2)) < 0.05
        )
        {
            col.rgb += vec3(0.1,0.1,0.1);
            col.a = 1.0;
        }
        // Rest
        else
        {
            col.rgb += vec3(1.0,1.0,1.0);
            col.a = 1.0;
        }
    }
    
    else if (
        pos.y < -0.4 + 0.5 * cos(4.5 * pos.x)
        &&
        pos.y > -0.5 + 0.3 * cos(3.0 * pos.x)
    )
    {
        col.rgb += vec3(1.0,0.1,0.2);
        col.a = 1.0;
    }
    
    // Propeller
    else if (pos.x < 0.1 && pos.y < 0.0 && pos.x > -0.1 && pos.y > -0.3)
    {
        col.rgb += vec3(0.3,0.3,0.3) + 0.3 * cos(pos.x * 10.0 + 1.0);
        col.a = 1.0;
    }
       
    
    return col;
}

mat2 rotation(vec2 pos, float angle){
    mat2 r = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    return r;
}

void main(void){
	float x = UV.x * ratio;
	float y = UV.y;
	vec4 col = vec4(0.0);

	vec2 pos = vec2(x, y) - vec2(0.5 * ratio, 0.5);
	
	float angle = rocket_pos.z;
	angle += 0.01 * cos(time * PI2) + 0.02 * cos(2.0 * time * PI2);
	vec2 rp = (pos - rocket_pos.xy) * rotation(pos, angle);
	rp *= 4.0;
        
	if(pass == 1){
		// Draw smoke
		col += texture2D(pass1, lastUV + vec2(0.0, 0.02));
		col += texture2D(pass1, lastUV + vec2(0.003, 0.04));
		col += texture2D(pass1, lastUV + vec2(-0.003, 0.04));
		vec2 smoke_pos = (pos  - rocket_pos.xy) * rotation(pos, angle);

		if(distance(smoke_pos, vec2(0.0)) < 0.15){
			for(int i = 0; i < 10; i++){
				float fi = float(i);
				float xoff = 0.01 * sin(fi * 4.0 + time * 3.0);
				float yoff = 0.03 * cos(fi * 3.0 + time * 5.0);
				float doff = 0.003 * cos(time * 10.0 + fi);
				if(distance(smoke_pos, vec2(xoff, -0.09 + yoff)) < 0.017 + doff){
					col.rgb +=
						vec3(1.0, 0.3, 0.1) *
						(0.3 + 0.1 * cos(time * 20.0 + fi + 1.0));
				}
			}
		}
		col *= 0.4;
		// Make whiter smoke with time
		col = 0.85 * col + 0.15 * length(col.rgb)/3.0;
	} else if (pass == 2) {
		col = texture2D(lastPass, lastUV);
	} else {
		// Sky
		col.r += pos.y * 0.4 + 0.4;
		col.b += pos.y * 0.3 + 0.4;
		// Smoke
		col += texture2D(lastPass, lastUV);
		vec4 r = rocket(rp);
        col = col * (1.0 - r.a) + r * r.a;
	}
	
	col.a = 1.0;
	
	gl_FragColor = col;
}
