/*
  frag.glsl
  
  Copyright 2017 Antoine Morin-Paulhus
  
  You may use this file under the terms of the 
  Creative Commons "Attribution-NonCommercial 3.0 Unported" License.
  You may find details of this license at the following URL: 
  
  https://creativecommons.org/licenses/by-nc/3.0/legalcode
  
 */

precision highp float;

varying vec2 UV;
uniform vec3 iResolution;
uniform vec2 renderBufferRatio;
uniform vec3 rocket_pos;
uniform vec3 rocket_speed;
uniform vec2 star;
uniform vec2 asteroid;
uniform float accelerating;
varying vec2 lastUV;
uniform float time;
uniform float flashing;
uniform int pass;
uniform sampler2D pass0;
uniform sampler2D pass1;
uniform sampler2D pass2;
uniform sampler2D lastPass;
uniform float ratio;

#define PI 3.14159265359
#define PI2 6.28318

//PASSES=3

vec4 rocket_side(vec2 pos){
    vec4 col = vec4(0.0);
	
    // Clip (because otherwise a sine is repeated)
    if(pos.x < -0.5 || pos.x > 0.5){
        return col;
    }
    
    if(
      // Base parabolic shape
		(pos.y > -0.14 && 3.0 * (pos.y - 0.3) < cos(pos.x * 8.0) * (2.0 - pos.y))
		&&
		(pos.y > 0.0 || distance(pos, vec2(0.0, 0.1)) < 0.27))
    {
        // Window
        if (
            distance(pos, vec2(0.0,0.2)) < 0.05
        )
        {
            col.rgb += 0.4;
            col.a = 1.0;
        }
        // Rest
        else
        {
            col.rgb += 0.98;
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
    else if (pos.x < 0.1 && pos.y < 0.0 && pos.y > -0.3)
    {
        col.rgb += vec3(0.3,0.3,0.3) + 0.3 * cos(pos.x * 10.0 + 1.0);
        col.a = 1.0;
    }
    
    return col;
}

vec4 rocket(vec2 pos){
	if(pos.x > 0.0){
		return rocket_side(pos);
	} else {
		return rocket_side(pos * vec2(-1.0, 1.0));
	}
}

mat2 rotation(vec2 pos, float angle){
    mat2 r = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    return r;
}

float tri(float a){
	float aa = mod(a, 1.0);
	if(aa < 0.5){
		return aa * 2.0;
	} else {
		return 1.0 - (aa - 0.5) * 2.0;
	}
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

	// Asteroid distance
	float ad = distance(pos.xy, asteroid);
	
	vec2 pixel = 1.0 / iResolution.xy;
	
	if(pass == 1){
		// Draw smoke
		float spreadfac = 1.0 - abs(rocket_speed.y) * 10.0;
		float speedfac = 1.0 * length(abs(rocket_speed.xy));
		col += 0.1 * texture2D(pass1, lastUV + vec2(0.0, 0.002));
		col += 0.2 * texture2D(pass1, lastUV + vec2(0.0, 0.008));
		col += 0.5* texture2D(pass1, lastUV + vec2(0.0, 0.03));
		col += 0.5 * texture2D(pass1, lastUV + vec2(0.002, 0.0));
		col += 0.5 * texture2D(pass1, lastUV + vec2(-0.002, 0.0));
		col += 0.5 * texture2D(pass1, lastUV + vec2(0.008, 0.0));
		col += 0.5 * texture2D(pass1, lastUV + vec2(-0.008, 0.0));
		
		col *= 0.44;
		
		vec2 smoke_pos = (pos  - rocket_pos.xy) * rotation(pos, angle);
		smoke_pos += vec2(0.0, 0.1);
		smoke_pos += vec2(0.0, 0.06 * accelerating);
		smoke_pos *= vec2(1.0, 1.0 - 0.5 * accelerating);
		
		float sd = distance(smoke_pos, vec2(0.0)) / 0.06;
		
		if(sd < 1.0){
			float smokeblend = (1.0 - sd);
			smokeblend = pow(smokeblend, 2.0);
			
			col.rgb += smokeblend * vec3(1.0, 0.4, 0.1);
			col.g += 0.6 * accelerating * smokeblend * (1.0 + 0.5 * cos(time * 20.0 + pos.y * 10.0));
			
		}
		col *= 0.8;
		// Make whiter smoke with time
		col = 0.85 * col + 0.15 * length(col.rgb)/3.0;

		// Asteroid smoke
		if(ad < 0.1){
			col.rgb += 0.01 * (1.0 - ad)/0.1 * vec3(1.0, 0.3, 0.4);
		}
		
	} else if (pass == 2) {
		// Smoke
		col += texture2D(lastPass, lastUV);
	} else if (pass == 3){
		// Sky
		col.r += pos.y * 0.4 + 0.05 * cos(pos.y * 0.3 + time * 0.4) + 0.4;
		col.b += 0.3 * pos.y + 0.1 * cos(pos.y * 0.3 + time * 1.0) + 0.4;
				
		// Add star
		if(distance(pos, star) < 0.1){
			float closefac = 0.0;
			float rd = distance(rocket_pos.xy, star) / 0.4;

			if(rd < 1.0){
				closefac += 1.0 - rd;
			}
			
			vec2 sp = (pos - star);
			float angle = atan(sp.y, sp.x);
			float d = length(sp) / (0.04 + 0.08 * closefac);

			float f = 1.0 - tri(angle * 5.0 / PI2) * 0.27;

			if(d < f){
				col.rg += 0.8;
			}
		}
		
		// Rocket
		vec4 r = rocket(rp);
		
		if(flashing > 0.5){
			r *= cos(time * 170.0);
		}

		col = col * (1.0 - r.a) + r * r.a;
		
		float rd = distance(pos, rocket_pos.xy) / 0.2;

		// Subtle Rocket glow
		if(rd < 1.0){
			col.r += 0.1 * abs(cos(time)) * (1.0 - rd);
			col.g += 0.1 * abs(cos(1.2 * time + 1.0)) * (1.0 - rd);
			col.b += 0.1 * abs(cos(1.3 * time + 2.0)) * (1.0 - rd);
		}
		
		
		// Smoke:
		col += texture2D(lastPass, lastUV);

		// Add asteroid
		if(ad < 0.2){
			ad = ad/0.12;
			vec2 ap = (pos - asteroid);
			float angle = atan(ap.y, ap.x);
			angle += time * 2.0;
			float f = 1.0 - cos(angle * 6.0) * 0.07 - cos(angle * 20.0 + 1.0) * 0.02 - cos(angle * 3.0 + 2.0) * 0.04;

			if(ad < f){
				col.rgb *= 0.0;
				col.rgb += vec3(0.6, 0.2, 0.2);
				col.rgb += 0.1 * cos(ad * 4.0 + f);
			}
		}
		
		col *= 1.0 - 0.3 * pow(length(pos),2.0);
	}
	
	col.a = 1.0;
	
	gl_FragColor = col;
}
