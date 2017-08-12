/*
  Resources: 
  
  * https://gist.github.com/mbostock/5440492
  * http://memfrag.se/blog/simple-vertex-shader-for-2d
  * https://www.opengl.org/wiki/Data_Type_%28GLSL%29#Vector_constructors
  * https://www.opengl.org/wiki/Built-in_Variable_%28GLSL%29
  * https://www.khronos.org/registry/gles/specs/2.0/GLSL_ES_Specification_1.0.17.pdf

  */

var sg_api = window.location.protocol + "//" + window.location.host + ":4002/api";
var fragment_code = "";

var is_example = window.location.href.match(/\?file\=([_a-zA-Z0-9\/]+\.glsl)/);
var DEFAULT_WIDTH = window.innerWidth;
var DEFAULT_HEIGHT = window.innerHeight;
var started = false;

var app = new Vue({
    el: "#shadergame-app",
    data: {
        canvas: null,
		points: 0,
		has_sg_api: false,
		sound_mode: false,
		send_status: "",
        error: "",
		passes: 1,
		passes_defined_in_code: false,
		ratio: 1,
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
		mouse: [0, 0],
		images: []
    },
    watch: {
		'gifjs.dithering': function(d){
			// Convert string to null
			if(d == "false"){
				this.gifjs.dithering = false;
			}
		},
        width: function(w){
            this.canvas.width = w;
			this.re_init_ctx();
        },
        height: function(h){
            this.canvas.height = h;
			this.re_init_ctx();
        },
		passes: function(){
			this.re_init_ctx();
		}
    },
    methods: {
		re_init_ctx: function(){
			init_ctx(gl);
		},
	 	manage_passes: function(){
			var c = fragment_code;
			// Verify if passes is set there
			var re = /\/\/PASSES=([0-6])/;
			var result = re.exec(c);
			
			if(result == null){
				this.passes_defined_in_code = false;
			} else {
				this.passes_defined_in_code = true;
				this.passes = parseInt(result[1]);
			}
		},
		recompile: function(){
			update_shader();
		},
		canvas_mousemove: function(e){
			var c = e.target;
			var x = (e.clientX - c.offsetLeft) / this.width - 0.5;
			var y = (e.clientY - c.offsetTop) / this.height - 0.5;
			this.mouse = [x, -y];
		}
    }
});

function resize(){
	if(started){
		app.re_init_ctx();
		app.width = window.innerWidth;
		app.height = window.innerHeight;
	}
}

resize();
window.addEventListener("resize",resize);

var anim_delay = 100;
var frame = 0;

var filename = "";

if(is_example != null){
    filename = is_example[1] || "";
}

var game_canvas = qsa(".game-canvas")[0];

{
	game_canvas.width = DEFAULT_WIDTH;
	game_canvas.height = DEFAULT_HEIGHT;
	
	app.canvas = game_canvas;
}

var gl = game_canvas.getContext("webgl");
var fragment_error_pre = qsa(".fragment-error-pre")[0];
var vertex_error_pre = qsa(".vertex-error-pre")[0];

// Create render to texture stuff
var rttTexture = [];
var framebuffer = [];
var renderbuffer = [];
var renderBufferDim = [];

// Audio stuff
var pixels = new Uint8Array(game_canvas.width * game_canvas.height * 4);
var timeout = null;

function init_ctx(ctx){
	var ww = 2;
	var hh = 2;
	var lastww = ww;
	var lasthh = hh;
	
	// Delete previous textures
	for(var i = 0; i < rttTexture.length; i++){
		gl.deleteTexture(rttTexture[i]);
		gl.deleteRenderbuffer(renderbuffer[i]);
		gl.deleteFramebuffer(framebuffer[i]);
	}

	
	// Find nearest power of 2 above width and height
	while(app.width > ww){
		ww <<= 1;
		lastww = ww;
	}
	while(app.height > hh){
		hh <<= 1;
		lasthh = hh;
	}

	// Use smaller power of 2 to save computing
	// & huge render textures
	ww = lastww;
	hh = lasthh;
	
	renderBufferDim = [ww, hh];
	
	for(var i = 0; i < app.passes; i++){

		rttTexture[i] = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, rttTexture[i]);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, ww, hh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

		// Render to texture stuff
		framebuffer[i] = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer[i]);
		
		renderbuffer = gl.createRenderbuffer();
		gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
		
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, rttTexture[i], 0);
		gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer[i]);
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, ww, hh);
	}

    ctx.clearColor(0.0, 0.0, 0.0, 1.0);
    ctx.enable(ctx.DEPTH_TEST);
    ctx.depthFunc(ctx.LEQUAL);
    ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT);

    // Triangle strip for whole screen square
    var vertices = [
            -1,-1,0,
            -1,1,0,
        1,-1,0,
        1,1,0,
    ];
    
    var tri = ctx.createBuffer();
    ctx.bindBuffer(ctx.ARRAY_BUFFER,tri);
    ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array(vertices), ctx.STATIC_DRAW);
}

init_ctx(gl);

var vertex_code = load_script("vertex-shader");

// Fetch fragment code
try{
    var xhr = new XMLHttpRequest;
    xhr.open('GET', "./frag.glsl", true);
    xhr.onreadystatechange = function(){
        if (4 == xhr.readyState) {
            fragment_code = xhr.responseText;
			app.manage_passes();
			update_shader();
			started = true;
        }
    };
	xhr.setRequestHeader('Content-type', 'text/plain');
    xhr.send();
} catch (e){
    // Do nothing
}

function add_error(err, type_str, type_pre){
	type_pre.textContent =
        "Error in " + type_str + " shader.\n" +
        err;
}

function init_program(ctx){
    ctx.program = ctx.createProgram();

    var vertex_shader =
        add_shader(ctx.VERTEX_SHADER, vertex_code);
    
    var fragment_shader =
        add_shader(ctx.FRAGMENT_SHADER, fragment_code);
    
    function add_shader(type,content){
        var shader = ctx.createShader(type);
        ctx.shaderSource(shader,content);
        ctx.compileShader(shader);

        // Find out right error pre
        var type_pre = type == ctx.VERTEX_SHADER ?
            vertex_error_pre:
            fragment_error_pre;
        
        if(!ctx.getShaderParameter(shader, ctx.COMPILE_STATUS)){
            var err = ctx.getShaderInfoLog(shader);
            
            // Find shader type
            var type_str = type == ctx.VERTEX_SHADER ?
                "vertex":
                "fragment";
            
            add_error(err, type_str, type_pre);

            return -1;
        } else {
            type_pre.textContent = "";
        }

        ctx.attachShader(ctx.program, shader);
        
        return shader;
    }

    if(vertex_shader == -1 || fragment_shader == -1){
        return;
    }
    
    ctx.linkProgram(ctx.program);
    
    if(!ctx.getProgramParameter(ctx.program, ctx.LINK_STATUS)){
        console.log(ctx.getProgramInfoLog(ctx.program));
    }
    
    ctx.useProgram(ctx.program);

    var positionAttribute = ctx.getAttribLocation(ctx.program, "position");
    
    ctx.enableVertexAttribArray(positionAttribute);
    ctx.vertexAttribPointer(positionAttribute, 3, ctx.FLOAT, false, 0, 0);
}

function draw_ctx(can, ctx){

	if(ctx.program == undefined){
		return;
	}

	gl.uniform2fv(
		gl.getUniformLocation(ctx.program, 'renderBufferRatio'),
		[
			renderBufferDim[0] / app.width,
			renderBufferDim[1] / app.height
		]
	);
	
	gl.uniform3fv(
		gl.getUniformLocation(ctx.program, 'rocket_pos'),
		rocket_pos
	);
	
	gl.uniform3fv(
		gl.getUniformLocation(ctx.program, 'rocket_speed'),
		rocket_speed
	);
	
	gl.uniform2fv(
		gl.getUniformLocation(ctx.program, 'star'),
		star
	);
	
	gl.uniform1f(
		gl.getUniformLocation(ctx.program, 'accelerating'),
		accelerating
	);
	
	gl.uniform2fv(
		gl.getUniformLocation(ctx.program, 'mouse'),
		[ app.mouse[0], app.mouse[1] ]
	);
	
	for(var pass = 0; pass < app.passes; pass++ ){
		if(pass < app.passes - 1){
			ctx.bindFramebuffer(ctx.FRAMEBUFFER, framebuffer[pass]);
		} else {
			ctx.bindFramebuffer(ctx.FRAMEBUFFER, null);
		}

		// Manage lastpass
		if(pass > 0){
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, rttTexture[pass - 1]);
			gl.uniform1i(gl.getUniformLocation(ctx.program, 'lastPass'), pass - 1);
		}
		
		for(var i = 0; i < app.passes; i++){
			gl.activeTexture(gl.TEXTURE0 + i);
			if(i == pass){
				// Unbind current to prevent feedback loop
				gl.bindTexture(gl.TEXTURE_2D, null);
				continue;
			}
			var att = gl.getUniformLocation(ctx.program, "pass" + i);
			gl.bindTexture(gl.TEXTURE_2D, rttTexture[i]);
			gl.uniform1i(att,i);
		}

		var passAttribute = ctx.getUniformLocation(ctx.program, "pass");
		ctx.uniform1i(passAttribute, pass + 1);

		var timeAttribute = ctx.getUniformLocation(ctx.program, "time");
		var date = new Date();
		var gtime = (date.getTime() % (3600 * 24)) / 1000.0;
		ctx.uniform1f(timeAttribute, gtime);
		
		var iResolutionAttribute = ctx.getUniformLocation(ctx.program, "iResolution");
		
		ctx.uniform3fv(iResolutionAttribute,
					   new Float32Array(
						   [
							   can.width,
							   can.height,
							   1.0
						   ])
					  );
		
		// Screen ratio
		var ratio = can.width / can.height;
		app.ratio = ratio;
		var ratioAttribute = ctx.getUniformLocation(ctx.program, "ratio");
		ctx.uniform1f(ratioAttribute, ratio);
		
		ctx.drawArrays(ctx.TRIANGLE_STRIP, 0, 4);
		
		ctx.viewport(0, 0, can.width, can.height);
	}
}

function update_shader(){
    init_program(gl);
}

function update_screen(){
	draw_ctx(game_canvas, gl);
	compute();
	window.requestAnimationFrame(update_screen);
}

window.requestAnimationFrame(update_screen);

var rendering_gif = false;

var watched_keys = {
	" ": false,
	"ArrowLeft": false,
	"ArrowRight": false,
	"ArrowUp": false,
	"ArrowDown": false,
}

window.onkeydown = function(e){
	for(var i in watched_keys){
		if(e.key == i){
			watched_keys[i] = true;
		}
	}
};

window.onkeyup = function(e){
	for(var i in watched_keys){
		if(e.key == i){
			watched_keys[i] = false;
		}
	}
};

var last_time = null;
var last_dsecond = null; // (d for deci (10^-1))
var begin_time = new Date().getTime();
var rocket_pos = [0.0, -0.23, 0]; // Last is angle
var rocket_speed = [0.0, 0.0, 0]; // Last is angle'
var star = [0.0, -1.0];
var accelerating = 0;

function distance(vec1, vec2){
	return Math.sqrt(
		Math.pow(vec2[1] - vec1[1],2.0) +
		Math.pow(vec2[0] - vec1[0],2.0)
	);
}

function bonus(msg){
	var bonusdisp = qsa(".bonus-display")[0];
	bonusdisp.classList.add("bonus-anim");
	bonusdisp.innerText = msg;
	setInterval(function(){
		bonusdisp.classList.remove("bonus-anim");
		bonusdisp.innerText = "";
	},2000);
}

function compute(){
	var curr_time = new Date().getTime();
	var dt;

	if(last_time == null){
		dt = 30 / 100;
	} else {
		dt = (curr_time - last_time) / 100;
	}
	
	last_time = curr_time;
	curr_dsecond = Math.floor(curr_time / 10);
	
	// Passed one second?
	if(last_dsecond != curr_dsecond){
		app.points += 1;
	}

	last_dsecond = curr_dsecond;
	
	var angle = rocket_pos[2];
	
	if(watched_keys["ArrowLeft"]){
		rocket_speed[2] -= dt * 0.2 * (rocket_speed[2] + 1.4);
	}
	if (watched_keys["ArrowRight"]) {
		rocket_speed[2] += dt * 0.2 * (rocket_speed[2] + 1.4);
	}
	if(watched_keys["ArrowUp"]){
		rocket_speed[0] -= dt * 0.01 * Math.cos(angle + Math.PI/2);
		rocket_speed[1] += dt * 0.02 * Math.sin(angle + Math.PI/2);
		accelerating = 1.0;
	} else {
		accelerating = 0.0;
	}
	if (watched_keys["ArrowDown"]) {
		rocket_speed[0] += dt * 0.01 * Math.cos(angle + Math.PI/2);
		rocket_speed[1] -= dt * 0.02 * Math.sin(angle + Math.PI/2);
	}

	// Gravity towards normal position
	if(rocket_pos[1] > -0.3){
		rocket_speed[1] -= 0.03 * Math.abs(rocket_pos[1] + 0.3);
	} else {
		rocket_speed[1] += 0.03 * Math.abs(rocket_pos[1] + 0.3);
	}
	
	
	rocket_pos[0] += dt * rocket_speed[0];
	rocket_speed[0] *= 0.94;
	rocket_pos[1] += dt * rocket_speed[1];
	rocket_speed[1] *= 0.94;
	rocket_pos[2] += dt * rocket_speed[2];
	rocket_speed[2] *= 0.6;

	// Restrict angle
	if(rocket_pos[2] > 1.4){
		rocket_pos[2] = 1.4;
	} else if(rocket_pos[2] < -1.4){
		rocket_pos[2] = -1.4;
	}
	
	if(rocket_pos[1] > 1.0 / app.ratio){
		rocket_pos[1] = 1.0 / app.ratio;
	}
	if(rocket_pos[1] < -1.0 / app.ratio){
		rocket_pos[1] = -1.0 / app.ratio;
	}
	
	if(rocket_pos[0] > 1.0){
		rocket_pos[0] = 1.0;
	}
	if(rocket_pos[0] < -1.0){
		rocket_pos[0] = -1.0;
	}

	// Has point?
	if(distance(star, rocket_pos) < 0.1){
		coinaudio.play();
		star[1] = -1.0;
		app.points += 100;
		bonus("+100");
	}
	
	star[1] -= dt * 0.03;
	
	// Bring back star to the top
	if(star[1] < -1.2){
		star[1] = 1.0;
		star[0] = Math.random();
	}
}

var coinaudio = qsa("audio[name='coinsound']")[0];
coinaudio.volume = 0.2;

var musicaudio = qsa("audio[name='music']")[0];
musicaudio.volume = 0.1;
musicaudio.play();
