// === CONFIGURACIÓN GENERAL ===

// Canvas responsivo y visual mejorado
const canvas = document.createElement('canvas');
canvas.id = 'gameCanvas';
document.body.innerHTML = '';
document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
document.body.appendChild(canvas);
const ctx = canvas.getContext('2d');

function resizeCanvas() {
	canvas.width = window.screen.width;
	canvas.height = window.screen.height;
	document.body.style.width = '100vw';
	document.body.style.height = '100vh';
	canvas.style.width = '100vw';
	canvas.style.height = '100vh';
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
// For F11 fullscreen, listen for keydown and resize
window.addEventListener('keydown', function(e) {
	if (e.code === 'F11') {
		setTimeout(resizeCanvas, 500);
	}
});

// === ESTADOS DEL JUEGO ===
const GAME_STATE = {
	MENU: 'menu',
	LEVEL_SELECT: 'level_select',
	PLAYING: 'playing',
	CONTROLS: 'controls',
	WIN: 'win',
};
let state = GAME_STATE.MENU;

// === DATOS DE NIVELES ===
const levels = [
	{
		name: 'El Despertar',
		unlocked: true,
		story: [
			'Despiertas en un laboratorio futurista...',
			'Los científicos te observan tras el cristal.',
			'Debes superar las pruebas y escapar.'
		],
	},
	{ name: 'El Bosque', unlocked: false },
	{ 
		name: 'La Cueva Profunda', 
		unlocked: false,
		story: [
			'Te adentras en una cueva misteriosa...',
			'La oscuridad te rodea, pero tus ojos brillan en la penumbra.',
			'Un débil cristal azul parece llamarte desde la distancia.'
		]
	},
];
let currentLevel = 0;

// === FORMAS DEL PERSONAJE ===
const FORMS = {
	DESTRUCTOR: 'destructor',
	NINJA: 'ninja',
	MAGO: 'mago',
};
let playerForm = FORMS.DESTRUCTOR;


// === DATOS DEL JUGADOR ===
const player = {
	x: 120,
	y: 0,
	vx: 0,
	vy: 0,
	w: 48,
	h: 64,
	onGround: false,
	doubleJumpAvailable: false, // Ninja double jump
	wallJump: false,
	levitating: false,
	levitateTimer: 0,
	runningTimer: 0,
	embestida: false,
	dash: false,
	dashTimer: 0,
	dashCooldown: 0,
	platformCooldown: 0,
	slowTimeCooldown: 0,
	slowTimeActive: false,
	platforms: [],
};

// === INPUTS ===
const keys = {};
window.addEventListener('keydown', e => { keys[e.code] = true; });
window.addEventListener('keyup', e => { keys[e.code] = false; });

// === UTILIDADES ===
function drawText(text, x, y, size = 32, color = '#fff', align = 'center') {
	ctx.save();
	ctx.font = `${size}px Arial Black`;
	ctx.fillStyle = color;
	ctx.textAlign = align;
	ctx.fillText(text, x, y);
	ctx.restore();
}

// === MENÚ PRINCIPAL ===
function drawMenu() {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	// Fondo laboratorio oscuro con tubos y luces
	let grad = ctx.createLinearGradient(0,0,0,canvas.height);
	grad.addColorStop(0, '#181a24');
	grad.addColorStop(1, '#23243a');
	ctx.fillStyle = grad;
	ctx.fillRect(0,0,canvas.width,canvas.height);
	// Tubos verticales y luces
	for(let i=0;i<6;i++){
		ctx.save();
		ctx.globalAlpha = 0.10;
		ctx.fillStyle = ['#ff2e2e','#2e8bff','#ffe359'][i%3];
		ctx.fillRect(200+i*220, 0, 16, canvas.height);
		ctx.restore();
	}
	// Luces circulares
	let t = Date.now()/600;
	for(let i=0;i<3;i++){
		ctx.save();
		ctx.globalAlpha = 0.18+0.08*Math.sin(t+i*2);
		ctx.beginPath();
		ctx.arc(canvas.width/2-300+300*i, 180+20*Math.sin(t+i), 80, 0, Math.PI*2);
		ctx.fillStyle = ['#ff2e2e','#2e8bff','#ffe359'][i];
		ctx.shadowColor = ['#ff2e2e','#2e8bff','#ffe359'][i];
		ctx.shadowBlur = 40;
		ctx.fill();
		ctx.restore();
	}
	// Representación de los 3 héroes
	function drawHero(x, y, color, border) {
		ctx.save();
		ctx.shadowColor = color;
		ctx.shadowBlur = 32;
		ctx.fillStyle = color;
		ctx.beginPath();
		ctx.ellipse(x, y, 48, 64, 0, 0, Math.PI*2);
		ctx.fill();
		ctx.lineWidth = 6;
		ctx.strokeStyle = border;
		ctx.stroke();
		// Ojos
		ctx.shadowBlur = 0;
		ctx.fillStyle = '#fff';
		ctx.beginPath();
		ctx.arc(x-12, y-10, 6, 0, Math.PI*2);
		ctx.arc(x+12, y-10, 6, 0, Math.PI*2);
		ctx.fill();
		ctx.restore();
	}
	drawHero(canvas.width/2-300, 180, '#ff2e2e', '#a80000');
	drawHero(canvas.width/2, 180, '#2e8bff', '#0033a8');
	drawHero(canvas.width/2+300, 180, '#ffe359', '#bba800');
	// Logo con sombra y brillo
	ctx.save();
	ctx.shadowColor = '#ffe359';
	ctx.shadowBlur = 32;
	drawText('SHAPE SHIFT', canvas.width/2, 100, 72, '#ffe359');
	ctx.restore();
	// Botones formales y mágicos
	// Botones con animación de tamaño y hover
	const menuButtons = [
		{ text: 'JUGAR', y: 340, color: '#ffe359', bg: '#23243a' },
		{ text: 'CONTROLES', y: 410, color: '#2e8bff', bg: '#23243a' },
		{ text: 'OPCIONES', y: 480, color: '#ff2e2e', bg: '#23243a' },
		{ text: 'SALIR', y: 550, color: '#fff', bg: '#23243a' },
	];
	let menuMouseY = window._menuMouseY || -1;
	menuButtons.forEach(btn => {
		let hovered = menuMouseY > btn.y-36 && menuMouseY < btn.y+20;
		let scale = hovered ? 1.08 : 1.0;
		ctx.save();
		ctx.globalAlpha = 0.96;
		ctx.fillStyle = btn.bg;
		ctx.shadowColor = btn.color;
		ctx.shadowBlur = hovered ? 32 : 18;
		ctx.translate(canvas.width/2, btn.y);
		ctx.scale(scale, scale);
		ctx.fillRect(-180, -36, 360, 56);
		ctx.restore();
		drawText(btn.text, canvas.width/2, btn.y, hovered ? 44 : 40, btn.color);
	});
}

// === MENÚ DE NIVELES ===
function drawLevelSelect() {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	// Fondo laboratorio oscuro
	let grad = ctx.createLinearGradient(0,0,0,canvas.height);
	grad.addColorStop(0, '#181a24');
	grad.addColorStop(1, '#23243a');
	ctx.fillStyle = grad;
	ctx.fillRect(0,0,canvas.width,canvas.height);
	drawText('CAMINO DE NIVELES', canvas.width/2, 80, 56, '#ffe359');
	// Camino visual con degradado amarillo-azul y menos balanceo
	ctx.save();
	let gradPath = ctx.createLinearGradient(180, 220, 900, 220);
	gradPath.addColorStop(0, '#ffe359');
	gradPath.addColorStop(0.5, '#ffe359');
	gradPath.addColorStop(0.7, '#2e8bff');
	gradPath.addColorStop(1, '#2e8bff');
	ctx.strokeStyle = gradPath;
	ctx.lineWidth = 10;
	ctx.beginPath();
	let pathY = 220;
	ctx.moveTo(180, pathY);
	ctx.bezierCurveTo(400, pathY-60, 600, pathY+60, 900, pathY);
	ctx.stroke();
	ctx.restore();
	// Nodos con animación y glow (menos balanceo)
	levels.forEach((lvl, i) => {
		let t = Date.now()/600;
		let x = 180 + i*360;
		let y = pathY + Math.sin(t+i)*18;
		ctx.save();
		ctx.shadowColor = lvl.unlocked ? '#ffe359' : '#444';
		ctx.shadowBlur = lvl.unlocked ? 24 : 0;
		ctx.fillStyle = lvl.unlocked ? '#ffe359' : '#444';
		ctx.beginPath(); ctx.arc(x, y, 54, 0, Math.PI*2); ctx.fill();
		ctx.restore();
		drawText(lvl.name, x, y+80, 32, '#2e8bff');
		if (lvl.unlocked) drawText('JUGAR', x, y+130, 28, '#ffe359');
		else drawText('BLOQUEADO', x, y+130, 24, '#888');
	});
	// Botón volver con estilo de menú principal y animación
	let menuMouseY = window._menuMouseY || -1;
	let volverHovered = menuMouseY > canvas.height-116 && menuMouseY < canvas.height-64 && menuMouseY !== -1;
	let scale = volverHovered ? 1.08 : 1.0;
	ctx.save();
	ctx.globalAlpha = 0.96;
	ctx.fillStyle = '#23243a';
	ctx.shadowColor = '#ffe359';
	ctx.shadowBlur = volverHovered ? 32 : 18;
	ctx.translate(120, canvas.height-80);
	ctx.scale(scale, scale);
	ctx.fillRect(-10, -36, 220, 56);
	ctx.restore();
	drawText('← VOLVER', 120, canvas.height-80, volverHovered ? 36 : 32, '#ffe359', 'left');
	// Botón desbloquear todo
	let unlockHovered = menuMouseY > 20 && menuMouseY < 70;
	let unlockScale = unlockHovered ? 1.08 : 1.0;
	ctx.save();
	ctx.globalAlpha = 0.96;
	ctx.fillStyle = '#2e8bff';
	ctx.shadowColor = '#ffe359';
	ctx.shadowBlur = unlockHovered ? 32 : 18;
	ctx.translate(canvas.width-220, 50);
	ctx.scale(unlockScale, unlockScale);
	ctx.fillRect(-100, -20, 200, 50);
	ctx.restore();
	drawText('DESBLOQUEAR TODO', canvas.width-120, 60, unlockHovered ? 32 : 28, '#ffe359');
}

// === MENÚ DE CONTROLES ===
function drawControls() {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	// Fondo más formal y mágico
	let grad = ctx.createLinearGradient(0,0,canvas.width,canvas.height);
	grad.addColorStop(0, '#23243a');
	grad.addColorStop(0.5, '#2e8bff');
	grad.addColorStop(1, '#181a24');
	ctx.fillStyle = grad;
	ctx.fillRect(0,0,canvas.width,canvas.height);
	drawText('CONTROLES', canvas.width/2, 80, 56, '#ff2e2e');
	drawText('Mover: ← → o A D', canvas.width/2, 160, 36, '#222');
	drawText('Saltar: ESPACIO', canvas.width/2, 210, 36, '#222');
	drawText('Cambiar Forma: 1 (Destructor), 2 (Ninja), 3 (Mago)', canvas.width/2, 260, 32, '#2e8bff');
	drawText('Habilidad E: E', canvas.width/2, 310, 32, '#ff2e2e');
	drawText('Habilidad Q: Q (solo Mago)', canvas.width/2, 360, 32, '#ffe359');
	drawText('← VOLVER', 120, 500, 32, '#fff', 'left');
}

// === MENÚ DE OPCIONES ===
function drawOptions() {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	// Fondo épico y mágico
	let grad = ctx.createLinearGradient(0,0,canvas.width,canvas.height);
	grad.addColorStop(0, '#23243a');
	grad.addColorStop(0.5, '#ffe359');
	grad.addColorStop(1, '#2e8bff');
	ctx.fillStyle = grad;
	ctx.fillRect(0,0,canvas.width,canvas.height);
	// Efecto de partículas mágicas
	for(let i=0;i<18;i++){
		ctx.save();
		ctx.globalAlpha = 0.12+0.08*Math.sin(Date.now()/600+i);
		ctx.beginPath();
		ctx.arc(120+i*80, 120+10*Math.sin(Date.now()/600+i), 40+8*Math.sin(Date.now()/600+i*2), 0, Math.PI*2);
		ctx.fillStyle = i%2===0 ? '#ffe359' : '#2e8bff';
		ctx.shadowColor = i%2===0 ? '#ffe359' : '#2e8bff';
		ctx.shadowBlur = 24;
		ctx.fill();
		ctx.restore();
	}
	drawText('OPCIONES', canvas.width/2, 80, 48, '#ffde59');
	drawText('(Próximamente)', canvas.width/2, 200, 32);
	// Botón volver con estilo de menú principal y animación
	let mouseY = window._menuMouseY || -1;
	let menuMouseY = window._menuMouseY || -1;
	let volverHovered = menuMouseY > 464 && menuMouseY < 520 && menuMouseY !== -1;
	let scale = volverHovered ? 1.08 : 1.0;
	ctx.save();
	ctx.globalAlpha = 0.96;
	ctx.fillStyle = '#23243a';
	ctx.shadowColor = '#ffe359';
	ctx.shadowBlur = volverHovered ? 32 : 18;
	ctx.translate(120, 500);
	ctx.scale(scale, scale);
	ctx.fillRect(-10, -36, 220, 56);
	ctx.restore();
	drawText('← VOLVER', 120, 500, volverHovered ? 32 : 28, '#ffe359', 'left');
}

// === NARRATIVA DEL NIVEL ===
function drawStory() {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	let story = levels[currentLevel].story;
	drawText('Nivel 1: El Despertar', canvas.width/2, 120, 48, '#ffde59');
	story.forEach((line, i) => {
		drawText(line, canvas.width/2, 220 + i*60, 32);
	});
	drawText('Presiona ESPACIO para comenzar', canvas.width/2, 480, 28, '#fff');
}

// === REDISEÑO TOTAL DEL NIVEL 1 ===
// El laboratorio ahora es vertical, con zonas separadas y visuales mejorados
const labElements = [
	// Suelo principal
	{ type: 'ground', x: 0, y: canvas.height-80, w: canvas.width, h: 80 },
	// Zona tutorial
	{ type: 'panel', x: 80, y: canvas.height-200, w: 320, h: 40, text: 'Usa ← → para moverte y ESPACIO para saltar' },
	// Muro frágil (Destructor) - mucho más alto
	{ type: 'wall', x: 480, y: canvas.height-600, w: 48, h: 520, fragile: true, text: 'Rompe el muro con E (Destructor)' },
	// Zona de agua (Mago) - más larga
	{ type: 'water', x: 600, y: canvas.height-80, w: 340, h: 40, text: 'Solo el Mago puede cruzar' },
	// Plataforma alta (Ninja) - mucho más arriba
	{ type: 'platform', x: 980, y: canvas.height-420, w: 120, h: 20, text: 'Doble salto y dash (Ninja)' },
	// Gema secreta
	{ type: 'gem', x: 1100, y: canvas.height-460, w: 24, h: 24 },
	// Plataforma final (más alta que la del ninja)
	{ type: 'platform', x: 1400, y: canvas.height-520, w: 120, h: 20, text: 'Plataforma final' },
	// Puerta de escape (flotando encima de la plataforma final)
	{ type: 'door', x: 1450, y: canvas.height-600, w: 64, h: 80, text: 'Rompe la puerta con E (Destructor)' },
];
let collectedGem = false;
let showTutorial = true;

function drawLevel1() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let time = Date.now()/600;

    // Fondo futurista optimizado
    // Capa base simplificada
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // Grilla holográfica optimizada (menos líneas)
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = '#2e8bff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i=0; i<canvas.width; i+=80) { // Espaciado duplicado
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
    }
    for(let i=0; i<canvas.height; i+=80) {
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
    }
    ctx.stroke();
    ctx.restore();

    // Escáner holográfico simplificado
    ctx.save();
    let scanLineY = (time*100)%canvas.height;
    ctx.fillStyle = 'rgba(46,139,255,0.1)';
    ctx.fillRect(0, scanLineY-30, canvas.width, 60);
    ctx.restore();

    // Círculos de energía optimizados (menos círculos)
    for(let i=0; i<4; i++) { // Reducido a la mitad
        ctx.save();
        let x = 240+i*320; // Más espaciados
        let y = 120+10*Math.sin(time+i);
        let radius = 80+8*Math.sin(time*2+i);
        
        // Círculo base simplificado
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#2e8bff';
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI*2);
        ctx.fill();

        // Un solo anillo de energía
        ctx.strokeStyle = '#4a9aff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, radius*0.7, 0, Math.PI*2);
        ctx.stroke();
        ctx.restore();
    }

    // Sistema de tubos optimizado
    for(let i=0; i<4; i++) { // Menos tubos
        ctx.save();
        let tubeX = 300+i*320; // Más espaciados
        
        // Tubo base simplificado
        ctx.fillStyle = '#2a2a4a';
        ctx.fillRect(tubeX, 0, 20, canvas.height);

        // Energía simplificada
        ctx.globalAlpha = 0.4;
        let energyOffset = (time*100)%120;
        for(let j=energyOffset; j<canvas.height; j+=120) {
            ctx.fillStyle = '#ffe359';
            ctx.fillRect(tubeX, j, 20, 40);
        }

        // Conectores simplificados
        ctx.globalAlpha = 1;
        for(let k=0; k<canvas.height; k+=240) { // Menos conectores
            ctx.fillStyle = '#3a3a5a';
            ctx.fillRect(tubeX-5, k, 30, 15);
        }
        ctx.restore();
    }

    // Partículas optimizadas (menos partículas)
    ctx.save();
    ctx.fillStyle = '#2e8bff';
    ctx.globalAlpha = 0.3;
    for(let i=0; i<20; i++) { // Reducido a menos de la mitad
        let px = ((time*30 + i*200)%canvas.width + canvas.width)%canvas.width;
        let py = ((time*20 + i*250)%canvas.height + canvas.height)%canvas.height;
        ctx.fillRect(px, py, 2, 2); // Rectángulos en lugar de círculos
    }
    ctx.restore();
	// Elementos del laboratorio
	labElements.forEach(el => {
		if (el.type === 'ground') {
			ctx.save();
			// Base metálica del suelo
			let metalGrad = ctx.createLinearGradient(el.x, el.y, el.x, el.y+el.h);
			metalGrad.addColorStop(0, '#3a3a4a');
			metalGrad.addColorStop(1, '#1a1a2a');
			ctx.fillStyle = metalGrad;
			ctx.fillRect(el.x, el.y, el.w, el.h);

			// Patrón de rejilla optimizado
			ctx.globalAlpha = 0.3;
			ctx.strokeStyle = '#4a4a5a';
			ctx.lineWidth = 2;
			for(let x=el.x; x<el.x+el.w; x+=80) {
				for(let y=el.y; y<el.y+el.h; y+=80) {
					ctx.strokeRect(x, y, 80, 80);
				}
			}
			ctx.restore();
		}

		if (el.type === 'panel') {
			ctx.save();
			// Panel holográfico simplificado
			ctx.globalAlpha = 0.95;
			ctx.fillStyle = '#222228';
			ctx.fillRect(el.x, el.y, el.w, el.h);

			// Borde energético
			ctx.strokeStyle = '#ffe359';
			ctx.lineWidth = 3;
			ctx.strokeRect(el.x, el.y, el.w, el.h);
			
			// Texto optimizado
			drawText(el.text, el.x+el.w/2, el.y+28, 20, '#ffe359');
			ctx.restore();
		}

		if (el.type === 'wall' && el.fragile) {
			ctx.save();
			// Pared de energía roja simplificada
			ctx.fillStyle = '#ff2e2e';
			ctx.fillRect(el.x, el.y, el.w, el.h);

			// Efecto de energía básico
			let t = Date.now()/500;
			ctx.globalAlpha = 0.3 + Math.sin(t)*0.2;
			ctx.fillStyle = '#ff8080';
			ctx.fillRect(el.x, el.y, el.w, el.h);

			// Texto
			drawText(el.text, el.x+el.w/2, el.y-10, 16, '#fff');
			ctx.restore();
		}

		if (el.type === 'water') {
			ctx.save();
			// Base del agua
			ctx.fillStyle = '#2e8bff';
			ctx.fillRect(el.x, el.y, el.w, el.h);
			
			// Efecto de ondas similar al lodo
			let t = Date.now()/600;
			for(let i=0; i<el.w; i+=30) {
				ctx.beginPath();
				ctx.arc(el.x+i, el.y+6*Math.sin(t+i/40), 15, Math.PI, 2*Math.PI);
				ctx.fillStyle = '#5aa0ff';
				ctx.fill();
			}
			
			// Texto
			drawText(el.text, el.x+el.w/2, el.y-10, 16, '#fff');
			ctx.restore();
		}

		if (el.type === 'platform') {
			ctx.save();
			// Plataforma dorada simplificada
			ctx.fillStyle = '#ffe359';
			ctx.fillRect(el.x, el.y, el.w, el.h);

			// Borde simple
			ctx.strokeStyle = '#fff';
			ctx.lineWidth = 2;
			ctx.globalAlpha = 0.5;
			ctx.strokeRect(el.x, el.y, el.w, el.h);

			// Texto
			drawText(el.text, el.x+el.w/2, el.y-10, 16, '#fff');
			ctx.restore();
		}

		if (el.type === 'gem' && !collectedGem) {
			ctx.save();
			let t = Date.now()/1000;
			
			// Gema simplificada
			ctx.translate(el.x, el.y);
			ctx.rotate(t);
			
			ctx.fillStyle = '#ffe359';
			ctx.beginPath();
			ctx.moveTo(0, -12);
			ctx.lineTo(12, 0);
			ctx.lineTo(0, 12);
			ctx.lineTo(-12, 0);
			ctx.closePath();
			ctx.fill();

			// Brillo simple
			ctx.globalAlpha = 0.5;
			ctx.fillStyle = '#fff';
			ctx.beginPath();
			ctx.arc(0, 0, 6, 0, Math.PI*2);
			ctx.fill();

			ctx.restore();
			drawText('Gema secreta', el.x, el.y-18, 14, '#fff');
		}

		if (el.type === 'door') {
			ctx.save();
			// Puerta simplificada
			ctx.fillStyle = '#4a4a4a';
			ctx.fillRect(el.x, el.y, el.w, el.h);

			// Panel central
			ctx.fillStyle = '#333';
			ctx.fillRect(el.x+8, el.y+8, el.w-16, el.h-16);

			// Borde rojo
			ctx.strokeStyle = '#ff2e2e';
			ctx.lineWidth = 6;
			ctx.strokeRect(el.x+8, el.y+8, el.w-16, el.h-16);

			// Texto
			drawText(el.text, el.x+el.w/2, el.y-10, 16, '#fff');
			ctx.restore();
		}
	});
	// Elementos
	labElements.forEach(el => {
		if (el.type === 'ground') {
			// Suelo con textura
			player.doubleJumpAvailable = true;
			let pat = ctx.createLinearGradient(el.x, el.y, el.x, el.y+el.h);
			pat.addColorStop(0, '#444');
			pat.addColorStop(1, '#222');
			ctx.fillStyle = pat;
			ctx.shadowColor = '#222';
			ctx.shadowBlur = 24;
			ctx.fillRect(el.x, el.y, el.w, el.h);
			ctx.restore();
		}
		if (el.type === 'panel') {
			ctx.save();
			ctx.globalAlpha = 0.85;
			ctx.fillStyle = '#222';
			ctx.strokeStyle = '#ffe359';
			ctx.lineWidth = 3;
			ctx.fillRect(el.x, el.y, el.w, el.h);
			ctx.strokeRect(el.x, el.y, el.w, el.h);
			ctx.restore();
			drawText(el.text, el.x+el.w/2, el.y+28, 20, '#ffe359');
		}
		if (el.type === 'wall' && el.fragile) {
			ctx.save();
			let gradWall = ctx.createLinearGradient(el.x, el.y, el.x, el.y+el.h);
			gradWall.addColorStop(0, '#ff2e2e');
			gradWall.addColorStop(1, '#a80000');
			ctx.fillStyle = gradWall;
			ctx.shadowColor = '#ff2e2e';
			ctx.shadowBlur = 32;
			ctx.fillRect(el.x, el.y, el.w, el.h);
			ctx.restore();
			drawText(el.text, el.x+el.w/2, el.y-10, 16, '#fff');
		}
		if (el.type === 'water') {
			ctx.save();
			let gradWater = ctx.createLinearGradient(el.x, el.y, el.x+el.w, el.y);
			gradWater.addColorStop(0, '#2e8bff');
			gradWater.addColorStop(1, '#aaf0ff');
			ctx.fillStyle = gradWater;
			ctx.globalAlpha = 0.85;
			ctx.fillRect(el.x, el.y, el.w, el.h);
			// Olas animadas
			for(let i=0;i<el.w;i+=24){
				ctx.beginPath();
				ctx.arc(el.x+i, el.y+8+6*Math.sin(time+i/40), 12, Math.PI, 2*Math.PI);
				ctx.fillStyle = '#fff';
				ctx.globalAlpha = 0.12;
				ctx.fill();
			}
			ctx.restore();
			drawText(el.text, el.x+el.w/2, el.y-10, 16, '#fff');
		}
		if (el.type === 'platform') {
			ctx.save();
			let gradPlat = ctx.createLinearGradient(el.x, el.y, el.x, el.y+el.h);
			gradPlat.addColorStop(0, '#ffe359');
			gradPlat.addColorStop(1, '#fffbe6');
			ctx.fillStyle = gradPlat;
			ctx.shadowColor = '#ffe359';
			ctx.shadowBlur = 18;
			ctx.fillRect(el.x, el.y, el.w, el.h);
			ctx.restore();
			drawText(el.text, el.x+el.w/2, el.y-10, 16, '#fff');
		}
		if (el.type === 'gem' && !collectedGem) {
			ctx.save();
			ctx.shadowColor = '#ffde59';
			ctx.shadowBlur = 30;
			ctx.beginPath();
			ctx.moveTo(el.x, el.y-12);
			ctx.lineTo(el.x+12, el.y);
			ctx.lineTo(el.x, el.y+12);
			ctx.lineTo(el.x-12, el.y);
			ctx.closePath();
			ctx.fillStyle = '#ffde59';
			ctx.globalAlpha = 0.95+0.05*Math.sin(time*2);
			ctx.fill();
			ctx.restore();
			drawText('Gema secreta', el.x, el.y-18, 14, '#fff');
		}
		if (el.type === 'door') {
			ctx.save();
			ctx.shadowColor = '#ff2e2e';
			ctx.shadowBlur = 32;
			ctx.fillStyle = '#888';
			ctx.globalAlpha = 0.95;
			ctx.fillRect(el.x, el.y, el.w, el.h);
			// Detalles de puerta
			ctx.strokeStyle = '#ff2e2e';
			ctx.lineWidth = 6;
			ctx.strokeRect(el.x+8, el.y+8, el.w-16, el.h-16);
			ctx.restore();
			drawText(el.text, el.x+el.w/2, el.y-10, 16, '#fff');
		}
	});
	// Plataformas mágicas
	player.platforms.forEach(p => {
		ctx.save();
		let gradPlat = ctx.createLinearGradient(p.x, p.y, p.x, p.y+p.h);
		gradPlat.addColorStop(0, '#ffe359');
		gradPlat.addColorStop(1, '#fffbe6');
		ctx.fillStyle = gradPlat;
		ctx.globalAlpha = 0.7+0.2*Math.sin(time*2+p.x);
		ctx.shadowColor = '#ffe359';
		ctx.shadowBlur = 12;
		ctx.fillRect(p.x, p.y, p.w, p.h);
		ctx.restore();
		ctx.globalAlpha = 1;
	});
	// Tutorial visual
	if (showTutorial) {
		drawText('Usa ← → para moverte', 200, 120, 24);
		drawText('Espacio para saltar', 200, 150, 24);
		drawText('1/2/3 para cambiar forma', 200, 180, 24);
		drawText('E para habilidad especial', 200, 210, 24);
		drawText('Q para ralentizar tiempo (Mago)', 200, 240, 24);
		drawText('Presiona ENTER para ocultar tutorial', 200, 270, 20);
	}
	// Dibujar jugador
	drawPlayer();
	// UI
	drawText(`Forma: ${playerForm.toUpperCase()}`, canvas.width-40, 40, 24, '#fff', 'right');
	if (collectedGem) drawText('¡Gema obtenida!', canvas.width-40, 80, 20, '#ffde59', 'right');
	if (player.slowTimeActive) drawText('TIEMPO LENTO', canvas.width/2, 60, 32, '#2e8bff');
}

function drawPlayer(cx = 0) {
	let drawX = player.x - (cx || 0);
	let drawY = player.y;
	let color = '#fff';
	let glow = '#fff';
	let border = '#fff';
	if (playerForm === FORMS.DESTRUCTOR) { color = '#ff2e2e'; glow = '#ff2e2e'; border = '#a80000'; }
	if (playerForm === FORMS.NINJA) { color = '#2e8bff'; glow = '#2e8bff'; border = '#0033a8'; }
	if (playerForm === FORMS.MAGO) { color = '#ffe359'; glow = '#ffe359'; border = '#bba800'; }
	ctx.save();
	ctx.shadowColor = glow;
	ctx.shadowBlur = 32;
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.ellipse(drawX+player.w/2, drawY+player.h/2, player.w/2, player.h/2, 0, 0, Math.PI*2);
	ctx.fill();
	ctx.lineWidth = 4;
	ctx.strokeStyle = border;
	ctx.stroke();
	// Ojos animados
	ctx.save();
	ctx.shadowBlur = 0;
	ctx.fillStyle = '#fff';
	let eyeY = drawY+player.h/2-8;
	ctx.beginPath();
	ctx.arc(drawX+player.w/2-10, eyeY, 5, 0, Math.PI*2);
	ctx.arc(drawX+player.w/2+10, eyeY, 5, 0, Math.PI*2);
	ctx.fill();
	ctx.restore();
	ctx.restore();
}

// === LÓGICA DEL JUEGO ===

// === NIVEL 2: BOSQUE EXTERIOR ===
const level2Width = canvas.width * 6;
let cameraX = 0;
let ramasEstado = {};
// Ya no usamos enemigos azules; solo gusanos terrestres
let bosqueEnemies = [];
let bosqueCuervos = [
	{ x: 1200, y: canvas.height-400, w: 40, h: 32, vy: 0, target: 0, active: true, speed: 6 },
	{ x: 1800, y: canvas.height-420, w: 40, h: 32, vy: 0, target: 1, active: true, speed: 6 },
	{ x: 2600, y: canvas.height-420, w: 40, h: 32, vy: 0, target: 0, active: true, speed: 6 }
];
// Control de spawn continuo de cuervos
let cuervoSpawnTimer = 0;
// Gusanos: enemigos terrestres que patrullan en bucle
let bosqueGusanos = [
	{ x: 800, y: canvas.height-100, w: 64, h: 28, dir: 1, min: 800, max: 1100, speed: 1.4, alive: true },
	{ x: 1400, y: canvas.height-100, w: 64, h: 28, dir: -1, min: 1400, max: 1700, speed: 1.3, alive: true },
	{ x: 2000, y: canvas.height-100, w: 64, h: 28, dir: 1, min: 2000, max: 2200, speed: 1.4, alive: true },
	{ x: 2700, y: canvas.height-100, w: 64, h: 28, dir: -1, min: 2600, max: 2900, speed: 1.2, alive: true },
	{ x: 3200, y: canvas.height-100, w: 64, h: 28, dir: 1, min: 3200, max: 3500, speed: 1.3, alive: true },
	{ x: 3800, y: canvas.height-100, w: 64, h: 28, dir: -1, min: 3800, max: 4100, speed: 1.5, alive: true },
	{ x: 4300, y: canvas.height-100, w: 64, h: 28, dir: 1, min: 4300, max: 4600, speed: 1.4, alive: true }
];
const bosqueElements = [
	{ type: 'ground', x: 0, y: canvas.height-80, w: level2Width, h: 80 },
	// ramas bajas (fragiles) — más separadas
	{ type: 'platform', x: 380, y: canvas.height-180, w: 180, h: 24, text: 'Rama frágil', id: 'rama0', fragileBreak: true },
	{ type: 'platform', x: 900, y: canvas.height-220, w: 160, h: 24, text: 'Rama frágil', id: 'rama1', fragileBreak: true },
	{ type: 'platform', x: 1200, y: canvas.height-240, w: 140, h: 24, text: 'Rama frágil', id: 'rama1b', fragileBreak: true },
	// raíz gigante
	{ type: 'wall', x: 1400, y: canvas.height-420, w: 60, h: 340, fragile: false, text: 'Raíz gigante' },
	// Lodo más grande y visible (letal si no eres Mago)
	{ type: 'mud', x: 900, y: canvas.height-100, w: 1200, h: 80, text: 'Lodo' },
	// ramas intermedias y altas, mayor separación. rama2 es la rama muy alta y no se rompe
	{ type: 'platform', x: 1800, y: canvas.height-340, w: 140, h: 20, text: 'Rama frágil', id: 'rama3', fragileBreak: true },
	{ type: 'platform', x: 2600, y: canvas.height-520, w: 140, h: 20, text: 'Rama MUY ALTA', id: 'rama2', fragileBreak: false },
	{ type: 'platform', x: 3100, y: canvas.height-380, w: 120, h: 20, text: 'Rama flotante', id: 'rama4' },
	{ type: 'platform', x: 3700, y: canvas.height-320, w: 120, h: 20, text: 'Rama flotante', id: 'rama5', fragileBreak: true },
	// Sección extendida del nivel
	{ type: 'platform', x: 4100, y: canvas.height-280, w: 140, h: 20, text: 'Rama alta', id: 'rama6', fragileBreak: true },
	{ type: 'wall', x: 4400, y: canvas.height-400, w: 60, h: 320, fragile: false, text: 'Raíz gigante' },
	{ type: 'platform', x: 4600, y: canvas.height-450, w: 160, h: 20, text: 'Rama muy alta', id: 'rama7', fragileBreak: false },
	{ type: 'platform', x: 5000, y: canvas.height-380, w: 140, h: 20, text: 'Rama flotante', id: 'rama8', fragileBreak: true },
	{ type: 'wall', x: 5300, y: canvas.height-500, w: 60, h: 420, fragile: false, text: 'Raíz final' },
	{ type: 'platform', x: 5500, y: canvas.height-420, w: 180, h: 20, text: 'Rama del tesoro', id: 'rama9', fragileBreak: false },
	{ type: 'gem', x: 5600, y: canvas.height-460, w: 24, h: 24 },
	{ type: 'door', x: level2Width-100, y: canvas.height-600, w: 64, h: 80, text: 'Puerta del bosque' },
	// Árboles destructibles (trunks) que el Destructor debe romper
	{ type: 'tree', x: 2200, y: canvas.height-260, w: 80, h: 180, fragile: true, broken: false, text: 'Árbol bloqueador' },
	{ type: 'tree', x: 3300, y: canvas.height-280, w: 100, h: 200, fragile: true, broken: false, text: 'Árbol bloqueador' }
];

// Guarda estado inicial para resetear el nivel
const _initialBosqueState = {
	enemies: JSON.parse(JSON.stringify(bosqueEnemies)),
	gusanos: JSON.parse(JSON.stringify(bosqueGusanos)),
	cuervos: JSON.parse(JSON.stringify(bosqueCuervos)),
	ramasEstado: {}
};

function drawLevel2() {
    let t = Date.now()/600;
    
    // Cielo con aurora boreal mágica
    let skyGrad = ctx.createLinearGradient(0,0,0,canvas.height*0.6);
    skyGrad.addColorStop(0, '#0a1a2f');
    skyGrad.addColorStop(0.5, '#1a2e4a');
    skyGrad.addColorStop(1, '#2e3d5a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // Aurora boreal animada
    ctx.save();
    for(let i=0; i<3; i++) {
        let auroraGrad = ctx.createLinearGradient(0,0,0,canvas.height*0.4);
        auroraGrad.addColorStop(0, `rgba(${40+i*20},${180+i*20},${100+i*40},0)`);
        auroraGrad.addColorStop(0.4+0.1*Math.sin(t+i), `rgba(${40+i*20},${180+i*20},${100+i*40},0.12)`);
        auroraGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = auroraGrad;
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        for(let x=0; x<=canvas.width; x+=20) {
            ctx.lineTo(x, 40*Math.sin((x+cameraX*0.1)/200 + t + i));
        }
        ctx.lineTo(canvas.width, 0);
        ctx.fill();
    }
    ctx.restore();

    // Montañas lejanas con parallax (3 capas)
    for(let layer=0; layer<3; layer++) {
        ctx.save();
        let mountainColor = layer === 0 ? '#1a2e3d' : layer === 1 ? '#2a3e4d' : '#3a4e5d';
        ctx.fillStyle = mountainColor;
        ctx.globalAlpha = 0.8 - layer*0.2;
        
        let offset = cameraX * (0.1 + layer*0.1);
        for(let i=0; i<4; i++) {
            ctx.beginPath();
            let baseX = i*800 - (offset%800);
            ctx.moveTo(baseX-100, canvas.height*0.6);
            ctx.lineTo(baseX+200, canvas.height*0.3 - layer*40);
            ctx.lineTo(baseX+500, canvas.height*0.6);
            ctx.fill();
        }
        ctx.restore();
    }

    // Niebla del bosque con movimiento
    for(let i=0; i<3; i++) {
        ctx.save();
        let fogGrad = ctx.createRadialGradient(
            canvas.width*0.5, canvas.height*0.7,0,
            canvas.width*0.5, canvas.height*0.7,canvas.width*0.8
        );
        fogGrad.addColorStop(0, `rgba(255,255,255,${0.02+0.01*Math.sin(t+i)})`);
        fogGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = fogGrad;
        ctx.globalCompositeOperation = 'screen';
        ctx.fillRect(0,canvas.height*0.4,canvas.width,canvas.height*0.6);
        ctx.restore();
    }

    // Partículas flotantes (polvo/luciérnagas)
    ctx.save();
    for(let i=0; i<20; i++) {
        let x = ((i*123 + t*30)%canvas.width + cameraX*0.3)%canvas.width;
        let y = canvas.height*0.3 + Math.sin(t+i)*50;
        let size = 2 + Math.sin(t*2+i)*1;
        let alpha = 0.3 + 0.2*Math.sin(t*3+i);
        
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,${180+Math.sin(t+i)*40},${alpha})`;
        ctx.shadowColor = '#ffe';
        ctx.shadowBlur = 10;
        ctx.arc(x, y, size, 0, Math.PI*2);
        ctx.fill();
    }
    ctx.restore();
	// Elementos bosque (capas visuales mejoradas)
    // Árboles del fondo optimizados y mejorados
    for(let layer=0; layer<2; layer++) {
        ctx.save();
        let parallaxOffset = cameraX * (0.15 + layer*0.1);
        let treeSpacing = 400; // Más espacio entre árboles
        let treeHeight = 500 - layer*60;
        let treeWidth = 120 - layer*20;

        // Dibujamos menos árboles pero más detallados
        for(let i=-1; i<(canvas.width/treeSpacing)+2; i++) {
            let x = (i*treeSpacing - (parallaxOffset%treeSpacing));
            let y = canvas.height - 80 - treeHeight;

            // Tronco antiguo más natural
            let trunkGrad = ctx.createLinearGradient(x, y+treeHeight, x+treeWidth, y+treeHeight);
            trunkGrad.addColorStop(0, '#362921');
            trunkGrad.addColorStop(0.4, '#241810');
            trunkGrad.addColorStop(1, '#1a1208');
            
            ctx.fillStyle = trunkGrad;
            ctx.beginPath();
            // Base más ancha
            ctx.moveTo(x+treeWidth*0.2, y+treeHeight);
            // Tronco con curvas más naturales
            ctx.quadraticCurveTo(x+treeWidth*0.3, y+treeHeight*0.7, x+treeWidth*0.5, y+treeHeight*0.4);
            ctx.quadraticCurveTo(x+treeWidth*0.7, y+treeHeight*0.7, x+treeWidth*0.8, y+treeHeight);
            ctx.fill();

            // Sombras en el tronco
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath();
            ctx.moveTo(x+treeWidth*0.6, y+treeHeight);
            ctx.quadraticCurveTo(x+treeWidth*0.65, y+treeHeight*0.7, x+treeWidth*0.8, y+treeHeight);
            ctx.fill();

            // Copa del árbol más realista
            let treeColors = [
                '#1a4d1a', // Verde oscuro base
                '#2a5d2a', // Verde medio
                '#3a6d3a'  // Verde claro
            ];

            // Capas de follaje superpuestas
            for(let j=0; j<3; j++) {
                ctx.fillStyle = treeColors[j];
                ctx.globalAlpha = 0.8 - j*0.15;
                
                // Forma más orgánica para cada capa
                ctx.beginPath();
                let leafWidth = treeWidth * (1.2 - j*0.2);
                let leafHeight = treeHeight * 0.4;
                let leafY = y + j*40;

                // Curvas más naturales para las hojas
                ctx.moveTo(x+treeWidth*0.5-leafWidth/2, leafY+leafHeight);
                ctx.quadraticCurveTo(
                    x+treeWidth*0.5-leafWidth/4, leafY,
                    x+treeWidth*0.5, leafY+leafHeight*0.2
                );
                ctx.quadraticCurveTo(
                    x+treeWidth*0.5+leafWidth/4, leafY,
                    x+treeWidth*0.5+leafWidth/2, leafY+leafHeight
                );
                ctx.fill();
            }

            // Detalles de luz en el follaje
            ctx.globalAlpha = 0.1;
            ctx.fillStyle = '#fff';
            let t = Date.now()/1000;
            for(let k=0; k<3; k++) {
                let highlightX = x + treeWidth*0.3 + Math.sin(t+k)*treeWidth*0.2;
                let highlightY = y + 100 + k*40;
                ctx.beginPath();
                ctx.arc(highlightX, highlightY, 20, 0, Math.PI*2);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    // Suelo detallado con capas y vegetación
    ctx.save();
    // Base del suelo con textura
    let groundGrad = ctx.createLinearGradient(0, canvas.height-120, 0, canvas.height);
    groundGrad.addColorStop(0, '#2a3d1a');
    groundGrad.addColorStop(0.4, '#1a2a10');
    groundGrad.addColorStop(1, '#0a1a05');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, canvas.height-120, canvas.width, 120);

    // Simple textura de suelo
    ctx.fillStyle = '#3a5a2a';
    ctx.fillRect(0, canvas.height-90, canvas.width, 10);
    ctx.restore();

	// Elementos bosque
	bosqueElements.forEach(el => {
		let ex = el.x - cameraX;
		if (ex+el.w < 0 || ex > canvas.width) return;
		if (el.type === 'ground') {
			ctx.save();
			let pat = ctx.createLinearGradient(ex, el.y, ex, el.y+el.h);
			pat.addColorStop(0, '#3a2e1a');
			pat.addColorStop(1, '#222');
			ctx.fillStyle = pat;
			ctx.shadowColor = '#222';
			ctx.shadowBlur = 24;
			ctx.fillRect(ex, el.y, el.w, el.h);
			ctx.restore();
		}
		if (el.type === 'platform') {
            // Visual mejorada para ramas
            if (!ramasEstado[el.id]) ramasEstado[el.id] = {doblada:false, timer:0, angle:0, broken:false, particles: []};
            let state = ramasEstado[el.id];
            let doblada = state.doblada || false;
            let offsetY = doblada ? 18 : 0;

            // Sistema de partículas para rama rota
            if (state.broken) {
                ctx.save();
                // Trozos de madera rotos
                ctx.fillStyle = '#553322';
                ctx.globalAlpha = 0.8;
                for(let i=0; i<4; i++) {
                    let piece = {
                        x: ex + el.w*0.25 + i*(el.w*0.2),
                        y: el.y + offsetY + 6 + Math.sin(t+i)*2,
                        w: el.w*0.15,
                        h: el.h*0.4,
                        angle: Math.sin(t*0.5+i)*0.2
                    };
                    ctx.save();
                    ctx.translate(piece.x + piece.w/2, piece.y + piece.h/2);
                    ctx.rotate(piece.angle);
                    ctx.fillRect(-piece.w/2, -piece.h/2, piece.w, piece.h);
                    ctx.restore();
                }
                
                // Hojas/astillas cayendo
                if (!state.particles) state.particles = [];
                if (state.particles.length < 10 && Math.random() < 0.1) {
                    state.particles.push({
                        x: ex + Math.random()*el.w,
                        y: el.y + offsetY,
                        vx: (Math.random()-0.5)*2,
                        vy: Math.random()*2,
                        angle: Math.random()*Math.PI*2,
                        size: 2 + Math.random()*3,
                        life: 1
                    });
                }
                
                for(let i=state.particles.length-1; i>=0; i--) {
                    let p = state.particles[i];
                    p.x += p.vx;
                    p.y += p.vy;
                    p.vy += 0.1;
                    p.angle += 0.1;
                    p.life -= 0.01;
                    
                    if (p.life > 0) {
                        ctx.save();
                        ctx.globalAlpha = p.life * 0.6;
                        ctx.fillStyle = '#8B4513';
                        ctx.translate(p.x, p.y);
                        ctx.rotate(p.angle);
                        ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
                        ctx.restore();
                    } else {
                        state.particles.splice(i, 1);
                    }
                }
                ctx.restore();
                return;
            }

            let targetAngle = doblada ? 0.35 : 0;
            state.angle += (targetAngle - state.angle) * 0.06;
            
            ctx.save();
            ctx.translate(ex, el.y + offsetY);
            ctx.rotate(state.angle);

            // Rama mejorada con efectos
            // Sombra de la rama
            ctx.shadowColor = 'rgba(0,0,0,0.3)';
            ctx.shadowBlur = 15;
            ctx.shadowOffsetY = 10;

            // Base de la rama con gradiente más natural
            let gradBase = ctx.createLinearGradient(0,0,0,el.h);
            gradBase.addColorStop(0, '#9b7b58');
            gradBase.addColorStop(0.4, '#8a6a47');
            gradBase.addColorStop(1, '#6e4e2e');
            ctx.fillStyle = gradBase;
            ctx.fillRect(0, 0, el.w, el.h);

            // Textura de corteza detallada
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;
            
            // Vetas de madera orgánicas
            for(let i=0; i<5; i++) {
                ctx.beginPath();
                ctx.strokeStyle = `rgba(60,30,0,${0.1 + i*0.02})`;
                ctx.lineWidth = 1 + Math.random();
                let y = el.h * (i/5);
                ctx.moveTo(0, y);
                for(let x=0; x<=el.w; x+=el.w/8) {
                    ctx.lineTo(x, y + Math.sin(x/20 + i*5)*3);
                }
                ctx.stroke();
            }

            // Musgo/detalles en la rama
            if (Math.random() < 0.1) {
                ctx.fillStyle = 'rgba(50,80,50,0.1)';
                for(let i=0; i<3; i++) {
                    let mossX = Math.random()*el.w;
                    let mossY = Math.random()*el.h;
                    let mossSize = 2 + Math.random()*4;
                    ctx.beginPath();
                    ctx.arc(mossX, mossY, mossSize, 0, Math.PI*2);
                    ctx.fill();
                }
            }

            ctx.restore();

            // Brillo/resplandor en ramas mágicas (las más altas)
            if (el.y < canvas.height*0.4) {
                ctx.save();
                ctx.globalAlpha = 0.1 + 0.05*Math.sin(t*2);
                let glowGrad = ctx.createRadialGradient(
                    ex+el.w/2, el.y+offsetY+el.h/2, 0,
                    ex+el.w/2, el.y+offsetY+el.h/2, el.w/2
                );
                glowGrad.addColorStop(0, '#ffe');
                glowGrad.addColorStop(1, 'rgba(255,255,238,0)');
                ctx.fillStyle = glowGrad;
                ctx.fillRect(ex-20, el.y+offsetY-20, el.w+40, el.h+40);
                ctx.restore();
            }

            // Texto con sombra y brillo
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 4;
            drawText(el.text||'', ex+el.w/2 + Math.max(0, state.angle*20), el.y-10+offsetY, 14, '#fff');
            ctx.restore();
		}
		if (el.type === 'wall') {
            ctx.save();
            // Raíz principal
            let gradR = ctx.createLinearGradient(ex, el.y, ex+el.w, el.y+el.h);
            gradR.addColorStop(0, '#4a2a10');
            gradR.addColorStop(0.4, '#3a1a08');
            gradR.addColorStop(1, '#2a1a08');
            ctx.fillStyle = gradR;
            ctx.fillRect(ex, el.y, el.w, el.h);

            // Textura de raíces entrelazadas
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(30,15,5,0.4)';
            ctx.lineWidth = 4;
            // Raíces curvas
            for(let i=0; i<8; i++) {
                let startY = el.y + (el.h/8)*i;
                ctx.moveTo(ex, startY);
                ctx.bezierCurveTo(
                    ex + el.w*0.3, startY + 20,
                    ex + el.w*0.7, startY - 20,
                    ex + el.w, startY
                );
            }
            ctx.stroke();

            // Nudos y protuberancias
            for(let i=0; i<10; i++) {
                let knotX = ex + Math.sin(i*5.23)*el.w*0.3 + el.w*0.5;
                let knotY = el.y + (el.h/10)*i;
                let knotSize = 4 + Math.sin(i*3)*2;
                
                ctx.beginPath();
                ctx.fillStyle = 'rgba(20,10,0,0.3)';
                ctx.arc(knotX, knotY, knotSize, 0, Math.PI*2);
                ctx.fill();
            }

            // Efecto de profundidad
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(ex + el.w*0.8, el.y, el.w*0.2, el.h);

            ctx.restore();
            drawText(el.text||'', ex+el.w/2, el.y-10, 16, '#fff');
		}
		if (el.type === 'mud') {
            ctx.save();
            
            // Base del lodo con gradiente
            let mudGrad = ctx.createLinearGradient(ex, el.y, ex, el.y + el.h);
            mudGrad.addColorStop(0, '#8a7a4d');
            mudGrad.addColorStop(0.4, '#6e5e2e');
            mudGrad.addColorStop(1, '#4e3e1e');
            ctx.fillStyle = mudGrad;
            ctx.globalAlpha = 0.8;
            ctx.fillRect(ex, el.y, el.w, el.h);

            // Efecto de burbujas
            ctx.globalAlpha = 0.4;
            for(let i=0; i<el.w/40; i++) {
                let bubbleX = ex + (i*40 + Math.sin(t*2 + i*5)*10);
                let bubbleY = el.y + (Math.sin(t + i)*10) + el.h*0.3;
                let bubbleSize = 3 + Math.sin(t*3 + i)*2;
                
                let bubbleGrad = ctx.createRadialGradient(
                    bubbleX, bubbleY, 0,
                    bubbleX, bubbleY, bubbleSize
                );
                bubbleGrad.addColorStop(0, 'rgba(139,119,78,0.8)');
                bubbleGrad.addColorStop(1, 'rgba(139,119,78,0)');
                
                ctx.fillStyle = bubbleGrad;
                ctx.beginPath();
                ctx.arc(bubbleX, bubbleY, bubbleSize, 0, Math.PI*2);
                ctx.fill();
            }

            // Superficie ondulante
            ctx.beginPath();
            ctx.moveTo(ex, el.y);
            for(let x=0; x<=el.w; x+=20) {
                ctx.lineTo(ex + x, el.y + Math.sin(t*2 + x*0.05)*4);
            }
            ctx.lineTo(ex + el.w, el.y + el.h);
            ctx.lineTo(ex, el.y + el.h);
            ctx.closePath();
            
            // Brillo en la superficie
            let surfaceGrad = ctx.createLinearGradient(ex, el.y, ex, el.y + 10);
            surfaceGrad.addColorStop(0, 'rgba(255,255,255,0.1)');
            surfaceGrad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = surfaceGrad;
            ctx.fill();

            // Partículas flotantes
            ctx.globalAlpha = 0.3;
            for(let i=0; i<el.w/60; i++) {
                let particleX = ex + ((t*20 + i*60)%el.w);
                let particleY = el.y + el.h*0.2 + Math.sin(t + i)*10;
                
                ctx.fillStyle = '#9b8b6d';
                ctx.beginPath();
                ctx.arc(particleX, particleY, 2, 0, Math.PI*2);
                ctx.fill();
            }

            // Destellos en la superficie
            ctx.globalAlpha = 0.1 + Math.sin(t*3)*0.05;
            for(let i=0; i<el.w/100; i++) {
                let shineX = ex + i*100 + Math.sin(t + i)*20;
                let shineY = el.y + Math.sin(t*2 + i)*3;
                
                ctx.save();
                ctx.translate(shineX, shineY);
                ctx.rotate(Math.PI/4);
                ctx.fillStyle = '#fff';
                ctx.fillRect(-4, -4, 8, 8);
                ctx.restore();
            }

            ctx.restore();
            
            // Texto con sombra y efecto brillante
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 4;
            drawText(el.text||'', ex+el.w/2, el.y-10, 16, '#fff');
            ctx.restore();
		}
		if (el.type === 'tree') {
			// Dibujar tronco texturizado
			ctx.save();
			let trunkGrad = ctx.createLinearGradient(ex, el.y, ex, el.y+el.h);
			trunkGrad.addColorStop(0, '#6b3f1f');
			trunkGrad.addColorStop(1, '#4a2a14');
			ctx.fillStyle = trunkGrad;
			ctx.fillRect(ex, el.y, el.w, el.h);
			// corteza simple
			ctx.strokeStyle = 'rgba(0,0,0,0.12)';
			for (let yy=el.y+10; yy<el.y+el.h-10; yy+=14) {
				ctx.beginPath();
				ctx.moveTo(ex+4, yy);
				ctx.lineTo(ex+el.w-6, yy+6);
				ctx.stroke();
			}
			ctx.restore();
			// si está roto, mostrar hueco
			if (el.broken) {
				ctx.save();
				ctx.fillStyle = '#000';
				ctx.fillRect(ex+10, el.y+el.h/2, el.w-20, el.h/2-10);
				ctx.restore();
			}
			return;
		}
		if (el.type === 'gem') {
			ctx.save();
			ctx.shadowColor = '#ffde59';
			ctx.shadowBlur = 30;
			ctx.beginPath();
			ctx.moveTo(ex, el.y-12);
			ctx.lineTo(ex+12, el.y);
			ctx.lineTo(ex, el.y+12);
			ctx.lineTo(ex-12, el.y);
			ctx.closePath();
			ctx.fillStyle = '#ffde59';
			ctx.globalAlpha = 0.95+0.05*Math.sin(t*2);
			ctx.fill();
			ctx.restore();
			drawText('Gema oculta', ex, el.y-18, 14, '#fff');
		}
		if (el.type === 'door') {
			ctx.save();
			ctx.shadowColor = '#2e8bff';
			ctx.shadowBlur = 32;
			ctx.fillStyle = '#888';
			ctx.globalAlpha = 0.95;
			ctx.fillRect(ex, el.y, el.w, el.h);
			ctx.strokeStyle = '#2e8bff';
			ctx.lineWidth = 6;
			ctx.strokeRect(ex+8, el.y+8, el.w-16, el.h-16);
			ctx.restore();
			drawText(el.text||'', ex+el.w/2, el.y-10, 16, '#fff');
		}
	});

	// Enemigos patrullando (terrestres)
	bosqueEnemies.forEach(enemy => {
		if (!enemy.alive) return;
		// Patrulla
		enemy.x += enemy.dir * 2;
		if (enemy.x < enemy.min || enemy.x > enemy.max) enemy.dir *= -1;
		let ex = enemy.x - cameraX;
		ctx.save();
		ctx.fillStyle = '#2e8bff';
		ctx.shadowColor = '#2e8bff';
		ctx.shadowBlur = 12;
		ctx.fillRect(ex, enemy.y, enemy.w, enemy.h);
		ctx.restore();
	});

	// Gusanos con efectos mejorados
	bosqueGusanos.forEach(g => {
		if (!g.alive) return;
		let gx = g.x - cameraX;
		ctx.save();

		// Sombra del gusano
		ctx.shadowColor = 'rgba(0,0,0,0.2)';
		ctx.shadowBlur = 10;
		ctx.shadowOffsetY = 5;

		// Movimiento ondulante del cuerpo
		for (let s = 0; s < 6; s++) {
			let wseg = g.w - s*8;
			let offset = Math.sin(t*3 + s*0.5) * 4;
			let segmentX = gx + s*10 + Math.sin(t*2 + s)*3;
			let segmentY = g.y + g.h/2 + offset;

			// Gradiente para cada segmento
			let segGrad = ctx.createRadialGradient(
				segmentX, segmentY, 0,
				segmentX, segmentY, wseg/1.5
			);
			segGrad.addColorStop(0, `rgb(${140 - s*8}, ${80 + s*6}, ${50 + s*3})`);
			segGrad.addColorStop(0.7, `rgb(${100 - s*8}, ${60 + s*6}, ${40 + s*3})`);
			segGrad.addColorStop(1, `rgb(${80 - s*8}, ${40 + s*6}, ${30 + s*3})`);
			
			ctx.fillStyle = segGrad;
			ctx.beginPath();
			ctx.ellipse(segmentX, segmentY, wseg/2, g.h/2.2, Math.sin(t + s*0.5)*0.2, 0, Math.PI*2);
			ctx.fill();

			// Detalles del segmento
			ctx.strokeStyle = `rgba(0,0,0,0.1)`;
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.ellipse(segmentX, segmentY, wseg/2.5, g.h/2.5, Math.sin(t + s*0.5)*0.2, 0, Math.PI*2);
			ctx.stroke();
		}

		// Cabeza más detallada
		ctx.save();
		// Ojos brillantes
		for(let i=0; i<2; i++) {
			let eyeX = gx + 8 + i*8;
			let eyeY = g.y + g.h/2 - 2;
			
			// Brillo del ojo
			ctx.fillStyle = '#000';
			ctx.shadowColor = '#ff0';
			ctx.shadowBlur = 5;
			ctx.beginPath();
			ctx.arc(eyeX, eyeY, 3, 0, Math.PI*2);
			ctx.fill();

			// Reflejo en el ojo
			ctx.fillStyle = '#fff';
			ctx.beginPath();
			ctx.arc(eyeX-1, eyeY-1, 1, 0, Math.PI*2);
			ctx.fill();
		}
		
		// Mandíbulas/pinzas
		ctx.strokeStyle = '#502010';
		ctx.lineWidth = 2;
		let jawOffset = Math.sin(t*8)*2;
		ctx.beginPath();
		ctx.moveTo(gx + 4, g.y + g.h/2);
		ctx.lineTo(gx - 4, g.y + g.h/2 + jawOffset);
		ctx.moveTo(gx + 12, g.y + g.h/2);
		ctx.lineTo(gx + 16, g.y + g.h/2 - jawOffset);
		ctx.stroke();
		
		ctx.restore();
		ctx.restore();

		// Rastro de baba
		ctx.save();
		ctx.globalAlpha = 0.1;
		ctx.fillStyle = '#7a9';
		for(let i=0; i<5; i++) {
			let trailX = gx + g.w/2 + Math.cos(t + i)*g.w/3;
			let trailSize = 2 + Math.sin(t*2 + i)*1;
			ctx.beginPath();
			ctx.arc(trailX, g.y + g.h - 2, trailSize, 0, Math.PI*2);
			ctx.fill();
		}
		ctx.restore();
	});

	// Cuervos con efectos dramáticos
	bosqueCuervos.forEach(cuervo => {
		if (!cuervo.active) return;
		let ex = cuervo.x - cameraX;
		let t2 = Date.now()/300; // Tiempo más rápido para animaciones
		
		ctx.save();
		// Sombra dinámica
		ctx.shadowColor = 'rgba(0,0,0,0.3)';
		ctx.shadowBlur = 20;
		ctx.shadowOffsetY = 15;

		// Cuerpo del cuervo con plumas
		let bodyGrad = ctx.createRadialGradient(
			ex+cuervo.w/2, cuervo.y+cuervo.h/2, 0,
			ex+cuervo.w/2, cuervo.y+cuervo.h/2, cuervo.w/1.5
		);
		bodyGrad.addColorStop(0, '#000');
		bodyGrad.addColorStop(0.7, '#222');
		bodyGrad.addColorStop(1, '#000');
		
		// Alas con animación
		let wingAngle = cuervo.diving ? 
			Math.PI/3 : 
			Math.sin(t2) * 0.3 + 0.2;
		
		// Ala izquierda
		ctx.fillStyle = bodyGrad;
		ctx.save();
		ctx.translate(ex+cuervo.w/2, cuervo.y+cuervo.h/2);
		ctx.rotate(-wingAngle);
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.quadraticCurveTo(-cuervo.w/2, -cuervo.h/4, -cuervo.w*0.8, cuervo.h/4);
		ctx.quadraticCurveTo(-cuervo.w/2, cuervo.h/3, 0, 0);
		ctx.fill();
		ctx.restore();

		// Ala derecha
		ctx.save();
		ctx.translate(ex+cuervo.w/2, cuervo.y+cuervo.h/2);
		ctx.rotate(wingAngle);
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.quadraticCurveTo(cuervo.w/2, -cuervo.h/4, cuervo.w*0.8, cuervo.h/4);
		ctx.quadraticCurveTo(cuervo.w/2, cuervo.h/3, 0, 0);
		ctx.fill();
		ctx.restore();

		// Cuerpo central
		ctx.beginPath();
		ctx.ellipse(ex+cuervo.w/2, cuervo.y+cuervo.h/2, cuervo.w/3, cuervo.h/2, 0, 0, Math.PI*2);
		ctx.fill();

		// Pico amenazador
		ctx.save();
		let beakGrad = ctx.createLinearGradient(
			ex+cuervo.w/2, cuervo.y+cuervo.h/2,
			ex+cuervo.w/2+15, cuervo.y+cuervo.h/2
		);
		beakGrad.addColorStop(0, '#ffe359');
		beakGrad.addColorStop(1, '#ffa000');
		ctx.fillStyle = beakGrad;
		ctx.beginPath();
		ctx.moveTo(ex+cuervo.w/2, cuervo.y+cuervo.h/2-2);
		ctx.lineTo(ex+cuervo.w/2+15, cuervo.y+cuervo.h/2+2);
		ctx.lineTo(ex+cuervo.w/2, cuervo.y+cuervo.h/2+6);
		ctx.closePath();
		ctx.fill();
		// Detalle del pico
		ctx.strokeStyle = '#000';
		ctx.lineWidth = 1;
		ctx.stroke();
		ctx.restore();

		// Ojos brillantes rojos
		ctx.save();
		let eyeGlow = cuervo.diving ? 0.8 : 0.4 + Math.sin(t2*2)*0.2;
		ctx.fillStyle = `rgba(255,0,0,${eyeGlow})`;
		ctx.shadowColor = '#f00';
		ctx.shadowBlur = 10;
		ctx.beginPath();
		ctx.arc(ex+cuervo.w/2-8, cuervo.y+cuervo.h/2-2, 2, 0, Math.PI*2);
		ctx.fill();
		ctx.restore();

		// Estela de movimiento cuando está en picada
		if (cuervo.diving) {
			ctx.save();
			ctx.globalAlpha = 0.2;
			for(let i=0; i<5; i++) {
				let trailY = cuervo.y - i*15;
				ctx.beginPath();
				ctx.moveTo(ex+5, trailY);
				ctx.lineTo(ex+cuervo.w-5, trailY);
				ctx.strokeStyle = `rgba(0,0,0,${0.8-i*0.15})`;
				ctx.lineWidth = 3-i*0.5;
				ctx.stroke();
			}
			ctx.restore();
		}
		
		ctx.restore();
	});
	// Dibujar jugador
	drawPlayer(cameraX);

	// Plataformas mágicas visibles (Mago)
	player.platforms.forEach(p => {
		let ex = p.x - cameraX;
		ctx.save();
		let gradPlat = ctx.createLinearGradient(ex, p.y, ex, p.y+p.h);
		gradPlat.addColorStop(0, '#ffe359');
		gradPlat.addColorStop(1, '#fffbe6');
		ctx.fillStyle = gradPlat;
		ctx.globalAlpha = 0.9;
		ctx.shadowColor = '#ffe359';
		ctx.shadowBlur = 12;
		ctx.fillRect(ex, p.y, p.w, p.h);
		ctx.restore();
	});
	// UI
	drawText(`Forma: ${playerForm.toUpperCase()}`, canvas.width-40, 40, 24, '#fff', 'right');
	if (collectedGem) drawText('¡Gema obtenida!', canvas.width-40, 80, 20, '#ffde59', 'right');
	if (player.slowTimeActive) drawText('TIEMPO LENTO', canvas.width/2, 60, 32, '#2e8bff');
}

function resetLevel() {
	// Reinicia jugador y estado del nivel 2
	resetPlayer();
	cameraX = 0;
	// Restaurar arrays a su estado inicial
	bosqueEnemies = JSON.parse(JSON.stringify(_initialBosqueState.enemies));
	bosqueGusanos = JSON.parse(JSON.stringify(_initialBosqueState.gusanos));
	bosqueCuervos = JSON.parse(JSON.stringify(_initialBosqueState.cuervos));
	ramasEstado = {};
	collectedGem = false;
	// Mantener en playing en nivel 1 -> 1
	currentLevel = 1;
	state = GAME_STATE.PLAYING;
}

// === LÓGICA DEL JUEGO ===


function updatePlayerLab() {
	// ...lógica original de movimiento y habilidades...
	let slowFactor = player.slowTimeActive ? 0.3 : 1;
	let speed = 5 * slowFactor;
	if (playerForm === FORMS.DESTRUCTOR && player.embestida) speed = 10;
	if (playerForm === FORMS.NINJA) speed = 7 * slowFactor;
	if (keys['ArrowLeft'] || keys['KeyA']) player.vx = -speed;
	else if (keys['ArrowRight'] || keys['KeyD']) player.vx = speed;
	else player.vx = 0;
	// Embestida Destructor
	if (playerForm === FORMS.DESTRUCTOR) {
		if (player.vx !== 0 && player.onGround) {
			player.runningTimer += 1/60;
			if (player.runningTimer > 2.5) player.embestida = true;
		} else {
			player.runningTimer = 0;
			player.embestida = false;
		}
	} else {
		player.runningTimer = 0;
		player.embestida = false;
	}
	// Dash Ninja
	if (playerForm === FORMS.NINJA && keys['KeyE'] && player.dashCooldown <= 0) {
		player.dash = true;
		player.dashTimer = 0.2;
		player.dashCooldown = 1.2;
	}
	if (player.dash) {
		player.vx = (keys['ArrowLeft'] || keys['KeyA']) ? -18 : 18;
		player.dashTimer -= 1/60;
		if (player.dashTimer <= 0) player.dash = false;
	}
	if (player.dashCooldown > 0) player.dashCooldown -= 1/60;
	// Saltar
	if ((keys['Space'] || keys['KeyW']) && player.onGround) {
		if (playerForm === FORMS.NINJA) {
			player.vy = -18 * slowFactor;
			player.canDoubleJump = true;
		} else if (playerForm === FORMS.MAGO) {
			player.vy = -15 * slowFactor;
			player.levitating = true;
			player.levitateTimer = 0;
		} else {
			player.vy = -12 * slowFactor;
		}
		player.onGround = false;
	}
	if (playerForm === FORMS.NINJA && (keys['Space'] || keys['KeyW']) && player.canDoubleJump && !player.onGround) {
		player.vy = -16 * slowFactor;
		player.canDoubleJump = false;
	}
	if (playerForm === FORMS.MAGO && !player.onGround) {
		if (keys['Space'] && player.levitateTimer < 2) {
			player.vy = Math.max(player.vy, 0 * slowFactor);
			player.levitateTimer += 1/60;
		} else {
			player.vy += 0.8 * slowFactor;
		}
	} else {
		player.levitateTimer = 0;
	}
	if (!player.onGround && playerForm !== FORMS.MAGO) player.vy += 0.6 * slowFactor;
	player.x += player.vx;
	player.y += player.vy;
	// Plataformas mágicas (Mago)
	if (playerForm === FORMS.MAGO && keys['KeyE'] && player.platformCooldown <= 0) {
		player.platforms.push({ x: player.x, y: player.y+player.h+8, w: 80, h: 16, timer: 2 });
		player.platformCooldown = 1.5;
	}
	if (player.platformCooldown > 0) player.platformCooldown -= 1/60;
	player.platforms.forEach(p => p.timer -= 1/60);
	player.platforms = player.platforms.filter(p => p.timer > 0);
	// Tiempo lento (Mago)
	if (playerForm === FORMS.MAGO && keys['KeyQ'] && player.slowTimeCooldown <= 0) {
		player.slowTimeActive = true;
		player.slowTimeCooldown = 3;
		setTimeout(()=>{player.slowTimeActive=false;},1200);
	}
	if (player.slowTimeCooldown > 0) player.slowTimeCooldown -= 1/60;
	// Colisiones
	player.onGround = false;
	labElements.forEach(el => {
		if (el.type === 'ground' && collide(player, el)) {
			player.y = el.y - player.h;
			player.vy = 0;
			player.onGround = true;
		}
		if (el.type === 'platform' && collide(player, el)) {
			player.y = el.y - player.h;
			player.vy = 0;
			player.onGround = true;
		}
		if (el.type === 'wall' && el.fragile && collide(player, el)) {
			if (playerForm === FORMS.DESTRUCTOR && keys['KeyE']) {
				el.fragile = false;
				for (let i=0; i<20; i++) {
					ctx.save();
					ctx.globalAlpha = 0.7;
					ctx.fillStyle = '#ff2e2e';
					ctx.beginPath();
					ctx.arc(el.x+el.w/2+Math.random()*40-20, el.y+el.h/2+Math.random()*40-20, 10, 0, Math.PI*2);
					ctx.fill();
					ctx.restore();
				}
			} else {
				player.x -= player.vx;
			}
			if (playerForm === FORMS.DESTRUCTOR && player.embestida) {
				el.fragile = false;
			}
		}
		if (el.type === 'water' && collide(player, el)) {
			if (playerForm !== FORMS.MAGO) {
				player.vy += 8;
				player.y += 12;
				if (player.y > el.y+el.h) resetPlayer();
			}
		}
		if (el.type === 'gem' && !collectedGem && collide(player, el)) {
			collectedGem = true;
		}
		if (el.type === 'door' && collide(player, el)) {
			if (playerForm === FORMS.DESTRUCTOR && keys['KeyE']) {
				state = GAME_STATE.WIN;
			}
			if (playerForm === FORMS.DESTRUCTOR && player.embestida) {
				state = GAME_STATE.WIN;
			}
		}
	});
	player.platforms.forEach(p => {
		if (collide(player, p)) {
			player.y = p.y - player.h;
			player.vy = 0;
			player.onGround = true;
		}
	});
	if (player.x < 0) player.x = 0;
	if (player.x + player.w > canvas.width) player.x = canvas.width - player.w;
	if (player.y + player.h > canvas.height) {
		player.y = canvas.height - player.h;
		player.vy = 0;
		player.onGround = true;
	}
}

function updatePlayerBosque() {
	// ...lógica original de movimiento y habilidades...
	let slowFactor = player.slowTimeActive ? 0.3 : 1;
	let speed = 5 * slowFactor;
	if (playerForm === FORMS.DESTRUCTOR && player.embestida) speed = 10;
	if (playerForm === FORMS.NINJA) speed = 7 * slowFactor;
	if (keys['ArrowLeft'] || keys['KeyA']) player.vx = -speed;
	else if (keys['ArrowRight'] || keys['KeyD']) player.vx = speed;
	else player.vx = 0;
	// Embestida Destructor
	if (playerForm === FORMS.DESTRUCTOR) {
		if (player.vx !== 0 && player.onGround) {
			player.runningTimer += 1/60;
			if (player.runningTimer > 2.5) player.embestida = true;
		} else {
			player.runningTimer = 0;
			player.embestida = false;
		}
	} else {
		player.runningTimer = 0;
		player.embestida = false;
	}
	// Dash Ninja
	if (playerForm === FORMS.NINJA && keys['KeyE'] && player.dashCooldown <= 0) {
		player.dash = true;
		player.dashTimer = 0.2;
		player.dashCooldown = 1.2;
	}
	if (player.dash) {
		player.vx = (keys['ArrowLeft'] || keys['KeyA']) ? -18 : 18;
		player.dashTimer -= 1/60;
		if (player.dashTimer <= 0) player.dash = false;
	}
	if (player.dashCooldown > 0) player.dashCooldown -= 1/60;
	// Saltar
	if ((keys['Space'] || keys['KeyW']) && player.onGround) {
		if (playerForm === FORMS.NINJA) {
			player.vy = -18 * slowFactor;
			player.canDoubleJump = true;
		} else if (playerForm === FORMS.MAGO) {
			player.vy = -15 * slowFactor;
			player.levitating = true;
			player.levitateTimer = 0;
		} else {
			player.vy = -12 * slowFactor;
		}
		player.onGround = false;
	}
	if (playerForm === FORMS.NINJA && (keys['Space'] || keys['KeyW']) && player.canDoubleJump && !player.onGround) {
		player.vy = -16 * slowFactor;
		player.canDoubleJump = false;
	}
	if (playerForm === FORMS.MAGO && !player.onGround) {
		if (keys['Space'] && player.levitateTimer < 2) {
			player.vy = Math.max(player.vy, 0 * slowFactor);
			player.levitateTimer += 1/60;
		} else {
			player.vy += 0.8 * slowFactor;
		}
	} else {
		player.levitateTimer = 0;
	}
	if (!player.onGround && playerForm !== FORMS.MAGO) player.vy += 0.6 * slowFactor;
	player.x += player.vx;
	player.y += player.vy;
	// Plataformas mágicas (Mago)
	if (playerForm === FORMS.MAGO && keys['KeyE'] && player.platformCooldown <= 0) {
		player.platforms.push({ x: player.x, y: player.y+player.h+8, w: 80, h: 16, timer: 2 });
		player.platformCooldown = 1.5;
	}
	if (player.platformCooldown > 0) player.platformCooldown -= 1/60;
	player.platforms.forEach(p => p.timer -= 1/60);
	player.platforms = player.platforms.filter(p => p.timer > 0);
	// Tiempo lento (Mago)
	if (playerForm === FORMS.MAGO && keys['KeyQ'] && player.slowTimeCooldown <= 0) {
		player.slowTimeActive = true;
		player.slowTimeCooldown = 3;
		setTimeout(()=>{player.slowTimeActive=false;},1200);
	}
	if (player.slowTimeCooldown > 0) player.slowTimeCooldown -= 1/60;
	// Colisiones
	player.onGround = false;
	cameraX = Math.max(0, Math.min(player.x + player.w/2 - canvas.width/2, level2Width-canvas.width));
	bosqueElements.forEach(el => {
		if (el.type === 'ground' && collide(player, el)) {
			player.y = el.y - player.h;
			player.vy = 0;
			player.onGround = true;
		}
		if (el.type === 'platform') {
				let state = ramasEstado[el.id];
				let doblada = state?.doblada || false;
				let offsetY = doblada ? 18 : 0;
				// Si rota/está rota, en draw se decide si se puede usar
				if (!state || !state.broken) {
					if (collide(player, {x:el.x, y:el.y+offsetY, w:el.w, h:el.h})) {
						player.y = el.y+offsetY - player.h;
						player.vy = 0;
						player.onGround = true;
						if (!ramasEstado[el.id]) ramasEstado[el.id] = {doblada:false, timer:0, angle:0, broken:false};
						ramasEstado[el.id].timer += 1/60;
						// Si la rama es frágil y el jugador permanece >0.5s se rompe
						if (el.fragileBreak && ramasEstado[el.id].timer > 0.5) {
							ramasEstado[el.id].broken = true;
							// opcional: generar partículas
						}
						if (ramasEstado[el.id].timer > 1.2) ramasEstado[el.id].doblada = true;
					} else if (ramasEstado[el.id]) {
						ramasEstado[el.id].timer -= 1/60;
						if (ramasEstado[el.id].timer <= 0) ramasEstado[el.id].doblada = false;
					}
				}
		}
		// Raíz gigante: bloquear lateralmente, pero permitir pasar por arriba
		if (el.type === 'wall') {
			if (collide(player, el)) {
				// Si el jugador está por encima (saltando sobre la raíz), permitir
				if (player.y + player.h <= el.y + 8) {
					player.y = el.y - player.h;
					player.vy = 0;
					player.onGround = true;
				} else {
					// Bloqueo lateral mínimo sin empujar hacia adentro
					if (player.x + player.w/2 < el.x + el.w/2) {
						player.x = el.x - player.w - 1;
					} else {
						player.x = el.x + el.w + 1;
					}
					player.vx = 0;
				}
			}
		}
		// Árbol destructible: colisión y ruptura por Destructor
		if (el.type === 'tree') {
			if (el.broken) return;
			// Colisión sólida
			if (collide(player, el)) {
				// Si el jugador es Destructor y presiona E o está embistiendo, romper el árbol
				if (playerForm === FORMS.DESTRUCTOR && (keys['KeyE'] || player.embestida)) {
					el.broken = true;
					// efectos y abrir paso
					return;
				}
				// Si está empujando desde la izquierda/derecha, bloquear movimiento
				if (player.x + player.w/2 < el.x + el.w/2) player.x = el.x - player.w - 1;
				else player.x = el.x + el.w + 1;
				player.vx = 0;
			}
		}
		if (el.type === 'mud' && collide(player, el)) {
			if (playerForm !== FORMS.MAGO) {
				player.vy += 8;
				player.y += 12;
				if (player.y > el.y+el.h) resetPlayer();
			}
		}
		if (el.type === 'gem' && !collectedGem && collide(player, el)) {
			collectedGem = true;
		}
		if (el.type === 'door' && collide(player, el)) {
			levels[2].unlocked = true;
			state = GAME_STATE.WIN;
		}
	});
	// Enemigos patrullando
	bosqueEnemies.forEach((enemy, idx) => {
		if (!enemy.alive) return;
		if (collide(player, enemy)) {
			// Muerte por tocar enemigo
			resetLevel();
		}
	});

	// Gusanos movimiento y colisión con jugador
	bosqueGusanos.forEach(g => {
		if (!g.alive) return;
		g.x += g.dir * g.speed;
		if (g.x < g.min || g.x > g.max) g.dir *= -1;
		if (collide(player, g)) {
			resetLevel();
		}
	});
	// Cuervos matan al jugador
	bosqueCuervos.forEach(cuervo => {
		if (!cuervo.active) return;
		if (collide(player, cuervo)) resetLevel();
	});

	// Movimiento y spawn de cuervos: reducción progresiva según avance
	cuervoSpawnTimer -= 1/60;
	let gusanosVivos = bosqueGusanos.filter(g => g.alive).length;
	
	// Calcular factor de spawn basado en la posición del jugador
	let progressFactor = player.x / (level2Width * 0.8); // usa 80% del nivel para la reducción
	let spawnDelay = 2.4 + (progressFactor * 4); // aumenta el delay de 2.4s hasta 6.4s
	
	// No spawnear si estamos en el último 20% del nivel o si el delay es muy alto
	if (cuervoSpawnTimer <= 0 && gusanosVivos > 0 && progressFactor < 0.8 && Math.random() > progressFactor*0.8) {
		cuervoSpawnTimer = spawnDelay;
		
		// elegir una plataforma rama aleatoria para la altura, excluyendo la más baja
		let plataformas = bosqueElements.filter(e => 
			e.type === 'platform' && 
			e.y < canvas.height - 200 && // excluir ramas bajas
			e.x < player.x + level2Width * 0.2 // no spawnear en el último tramo
		);
		
		if (plataformas.length > 0) {
			let choice = plataformas[Math.floor(Math.random()*plataformas.length)];
			let spawnY = choice ? choice.y - 6 : canvas.height*0.25;
			let spawnX = cameraX + canvas.width + 160;
			
			bosqueCuervos.push({ 
				x: spawnX, 
				y: spawnY, 
				w: 40, 
				h: 32, 
				vy: 0, 
				target: Math.floor(Math.random()*bosqueGusanos.length), 
				active: true, 
				diving: false, 
				speed: 6 - (progressFactor * 2) // reducir velocidad también
			});
		}
	}

	bosqueCuervos.forEach(cuervo => {
		if (!cuervo.active) return;
		// Movimiento horizontal constante hacia la izquierda
		cuervo.x -= cuervo.speed || 7;
		let target = bosqueGusanos[cuervo.target];
		if (target && target.alive) {
			let dx = Math.abs((cuervo.x + cuervo.w/2) - (target.x + target.w/2));
			// Si está cerca y arriba del gusano, 33% de chance de picada
			if (dx < 90 && !cuervo.diving && cuervo.y < target.y && Math.random() < 0.33) {
				cuervo.diving = true;
				cuervo.vy = 6;
			}
			if (cuervo.diving) {
				cuervo.y += cuervo.vy;
				cuervo.vy = Math.min(cuervo.vy + 1.2, 22);
				if (collide(cuervo, target)) {
					cuervo.active = false;
					cuervo.diving = false;
				}
			}
		} else {
			// reasignar target si es posible
			let vivos = bosqueGusanos.filter(g=>g.alive);
			if (vivos.length>0) cuervo.target = bosqueGusanos.indexOf(vivos[Math.floor(Math.random()*vivos.length)]);
		}
		// si salen muy a la izquierda los retiramos
		if (cuervo.x + cuervo.w < cameraX - 300) cuervo.active = false;
	});

	// Limpieza: eliminar enemigos muertos y cuervos inactivos de los arrays para evitar trabajo extra
	bosqueEnemies = bosqueEnemies.filter(e => e.alive === undefined || e.alive === true);
	bosqueCuervos = bosqueCuervos.filter(c => c.active === undefined || c.active === true);
	player.platforms.forEach(p => {
		if (collide(player, p)) {
			player.y = p.y - player.h;
			player.vy = 0;
			player.onGround = true;
		}
	});
	if (player.x < 0) player.x = 0;
	if (player.x + player.w > level2Width) player.x = level2Width - player.w;
	if (player.y + player.h > canvas.height) {
		player.y = canvas.height - player.h;
		player.vy = 0;
		player.onGround = true;
	}
}

function collide(a, b) {
	return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}


function resetPlayer() {
	player.x = 120;
	player.y = 0;
	player.vx = 0;
	player.vy = 0;
	player.onGround = false;
	player.canDoubleJump = false;
	player.levitating = false;
	player.platforms = [];
}

// === WIN SCREEN ===
function drawWin() {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	drawText('¡Has escapado del laboratorio!', canvas.width/2, 200, 48, '#ffde59');
	if (collectedGem) drawText('¡Encontraste la gema secreta!', canvas.width/2, 260, 32, '#ffde59');
	drawText('Presiona ENTER para volver al menú de niveles', canvas.width/2, 400, 28, '#fff');
}

// === NIVEL 3: LA CUEVA PROFUNDA ===
const level3Width = canvas.width * 8;
let caveCamera = { x: 0, lightRadius: 150 };
let crystalActivated = false;
let cartActivated = false;
let cartRiding = false;
let cartPosition = { x: 1200, y: 0, speed: 0 };
let leverPulled = false;
let bats = [];
let caveElements = [
    // Primer tramo (antes del carrito)
    { type: 'ground', x: 0, y: canvas.height-60, w: level3Width, h: 60 },
    { type: 'crystal', x: 800, y: canvas.height-200, w: 40, h: 40 },
    { type: 'lever', x: 1100, y: 100, w: 40, h: 40, activated: false },
    { type: 'cart', x: 1200, y: canvas.height-100, w: 120, h: 80, locked: true },
    
    // Rieles del carrito
    { type: 'rails', x: 1200, y: canvas.height-40, w: level3Width-1400, h: 20 },
    
    // Caminos alternativos y obstáculos (se generarán dinámicamente)
    ...Array.from({length: 12}, (_, i) => ({
        type: 'path',
        x: 2000 + i*500,
        y: canvas.height-40,
        safe: Math.random() > 0.5,
        obstacles: Array.from({length: Math.floor(Math.random()*3+1)}, () => ({
            x: Math.random()*400,
            type: Math.random() > 0.5 ? 'plank' : 'rock'
        }))
    }))
];

function drawLevel3() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let time = Date.now()/600;
    
    // Fondo negro de la cueva
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dibujar plataformas mágicas primero para que sean visibles en la oscuridad
    if (playerForm === FORMS.MAGO) {
        player.platforms.forEach(p => {
            let px = p.x - caveCamera.x;
            ctx.save();
            // Plataforma con brillo mágico
            let platformGrad = ctx.createLinearGradient(px, p.y, px, p.y + p.h);
            platformGrad.addColorStop(0, 'rgba(255,227,89,0.8)');
            platformGrad.addColorStop(1, 'rgba(255,251,230,0.6)');
            ctx.fillStyle = platformGrad;
            ctx.shadowColor = '#ffe359';
            ctx.shadowBlur = 20;
            ctx.fillRect(px, p.y, p.w, p.h);

            // Efecto de energía mágica
            ctx.globalAlpha = 0.4 + Math.sin(time * 2) * 0.2;
            let energyGrad = ctx.createRadialGradient(
                px + p.w/2, p.y + p.h/2, 0,
                px + p.w/2, p.y + p.h/2, p.w/2
            );
            energyGrad.addColorStop(0, 'rgba(255,227,89,0.4)');
            energyGrad.addColorStop(1, 'rgba(255,227,89,0)');
            ctx.fillStyle = energyGrad;
            ctx.fillRect(px - 20, p.y - 20, p.w + 40, p.h + 40);
            ctx.restore();
        });
    }
    
    if (!cartRiding) {
        // Círculo de luz alrededor del jugador
        let lightX = player.x + player.w/2 - caveCamera.x;
        let lightY = player.y + player.h/2;
        let gradient = ctx.createRadialGradient(
            lightX, lightY, 0,
            lightX, lightY, caveCamera.lightRadius
        );
        gradient.addColorStop(0, 'rgba(255,255,255,0.3)');
        gradient.addColorStop(0.7, 'rgba(255,255,255,0.1)');
        gradient.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Ojos brillantes del héroe
        let eyeColor;
        if (playerForm === FORMS.DESTRUCTOR) eyeColor = '#ff2e2e';
        if (playerForm === FORMS.NINJA) eyeColor = '#2e8bff';
        if (playerForm === FORMS.MAGO) eyeColor = '#ffe359';
        
        ctx.save();
        ctx.shadowColor = eyeColor;
        ctx.shadowBlur = 20;
        ctx.fillStyle = eyeColor;
        ctx.beginPath();
        ctx.arc(lightX-10, lightY-5, 4, 0, Math.PI*2);
        ctx.arc(lightX+10, lightY-5, 4, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
    }
    
    // Si el cristal está activado, iluminar la zona
    if (crystalActivated) {
        let crystalLight = ctx.createRadialGradient(
            800 - caveCamera.x, canvas.height-200, 0,
            800 - caveCamera.x, canvas.height-200, 400
        );
        crystalLight.addColorStop(0, 'rgba(100,200,255,0.3)');
        crystalLight.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = crystalLight;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Dibujar elementos de la cueva
    caveElements.forEach(el => {
        let ex = el.x - caveCamera.x;
        if (ex < -200 || ex > canvas.width + 200) return;
        
        if (el.type === 'ground') {
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(ex, el.y, el.w, el.h);
            
            // Detalles de roca
            ctx.save();
            ctx.globalAlpha = 0.1;
            for(let i=0; i<el.w; i+=100) {
                ctx.fillStyle = '#fff';
                ctx.fillRect(ex+i, el.y, 2, el.h);
            }
            ctx.restore();
        }
        
        else if (el.type === 'crystal') {
            ctx.save();
            ctx.shadowColor = '#2e8bff';
            ctx.shadowBlur = crystalActivated ? 30 : 15;
            ctx.fillStyle = crystalActivated ? '#5aa0ff' : '#2e8bff';
            ctx.globalAlpha = 0.8 + Math.sin(time*2)*0.2;
            ctx.beginPath();
            ctx.moveTo(ex, el.y);
            ctx.lineTo(ex+el.w/2, el.y-20);
            ctx.lineTo(ex+el.w, el.y);
            ctx.lineTo(ex+el.w/2, el.y+el.h);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        
        else if (el.type === 'lever' && !cartRiding) {
            ctx.save();
            ctx.fillStyle = '#8b4513';
            ctx.fillRect(ex, el.y, el.w, el.h);
            ctx.fillStyle = '#4a4a4a';
            ctx.fillRect(ex+15, el.y-20, 10, 40);
            ctx.translate(ex+20, el.y);
            ctx.rotate(el.activated ? -Math.PI/4 : Math.PI/4);
            ctx.fillRect(-5, -20, 10, 40);
            ctx.restore();
        }
        
        else if (el.type === 'cart') {
            ctx.save();
            ctx.fillStyle = '#4a4a4a';
            ctx.fillRect(ex, el.y, el.w, el.h);
            // Detalles del carrito
            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(ex+10, el.y+10, el.w-20, el.h-30);
            // Ruedas
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath();
            ctx.arc(ex+30, el.y+el.h-10, 15, 0, Math.PI*2);
            ctx.arc(ex+el.w-30, el.y+el.h-10, 15, 0, Math.PI*2);
            ctx.fill();
            if (el.locked) {
                ctx.strokeStyle = '#ff2e2e';
                ctx.lineWidth = 4;
                ctx.strokeRect(ex, el.y, el.w, el.h);
            }
            ctx.restore();
        }
        
        else if (el.type === 'rails') {
            ctx.save();
            ctx.strokeStyle = '#4a4a4a';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(ex, el.y);
            ctx.lineTo(ex+el.w, el.y);
            ctx.stroke();
            // Travesaños
            for(let i=0; i<el.w; i+=50) {
                ctx.fillStyle = '#2a2a2a';
                ctx.fillRect(ex+i, el.y-5, 30, 10);
            }
            ctx.restore();
        }
        
        else if (el.type === 'path' && cartRiding) {
            ctx.save();
            ctx.strokeStyle = el.safe ? '#4a4a4a' : '#ff2e2e';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(ex, el.y);
            ctx.lineTo(ex+400, el.y);
            ctx.stroke();
            
            // Obstáculos
            el.obstacles.forEach(obs => {
                if (obs.type === 'plank') {
                    ctx.fillStyle = '#8b4513';
                    ctx.fillRect(ex+obs.x, el.y-100, 80, 20);
                } else {
                    ctx.fillStyle = '#4a4a4a';
                    ctx.beginPath();
                    ctx.arc(ex+obs.x, el.y-40, 20, 0, Math.PI*2);
                    ctx.fill();
                }
            });
            ctx.restore();
        }
    });
    
    // Murciélagos perseguidores
    bats.forEach(bat => {
        let bx = bat.x - caveCamera.x;
        ctx.save();
        ctx.fillStyle = '#2a2a2a';
        ctx.globalAlpha = 0.8;
        
        // Cuerpo
        ctx.beginPath();
        ctx.ellipse(bx, bat.y, 15, 8, 0, 0, Math.PI*2);
        ctx.fill();
        
        // Alas
        let wingSpread = Math.sin(time*4)*20;
        ctx.beginPath();
        ctx.moveTo(bx, bat.y);
        ctx.quadraticCurveTo(bx-20, bat.y-wingSpread, bx-40, bat.y+5);
        ctx.quadraticCurveTo(bx-20, bat.y+5, bx, bat.y);
        ctx.moveTo(bx, bat.y);
        ctx.quadraticCurveTo(bx+20, bat.y-wingSpread, bx+40, bat.y+5);
        ctx.quadraticCurveTo(bx+20, bat.y+5, bx, bat.y);
        ctx.fill();
        
        // Ojos rojos
        ctx.fillStyle = '#ff2e2e';
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(bx-5, bat.y, 2, 0, Math.PI*2);
        ctx.arc(bx+5, bat.y, 2, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
    });
    
    if (!cartRiding) {
        drawPlayer(caveCamera.x);
    }
}

function updateLevel3() {
    if (!cartRiding) {
        // Movimiento normal del jugador
        let slowFactor = player.slowTimeActive ? 0.3 : 1;
        let speed = 5 * slowFactor;
        if (playerForm === FORMS.DESTRUCTOR && player.embestida) speed = 10;
        if (playerForm === FORMS.NINJA) speed = 7 * slowFactor;
        
        if (keys['ArrowLeft'] || keys['KeyA']) player.vx = -speed;
        else if (keys['ArrowRight'] || keys['KeyD']) player.vx = speed;
        else player.vx = 0;

        // Embestida Destructor
        if (playerForm === FORMS.DESTRUCTOR) {
            if (player.vx !== 0 && player.onGround) {
                player.runningTimer += 1/60;
                if (player.runningTimer > 2.5) player.embestida = true;
            } else {
                player.runningTimer = 0;
                player.embestida = false;
            }
        } else {
            player.runningTimer = 0;
            player.embestida = false;
        }

        // Dash Ninja
        if (playerForm === FORMS.NINJA && keys['KeyE'] && player.dashCooldown <= 0) {
            player.dash = true;
            player.dashTimer = 0.2;
            player.dashCooldown = 1.2;
        }
        if (player.dash) {
            player.vx = (keys['ArrowLeft'] || keys['KeyA']) ? -18 : 18;
            player.dashTimer -= 1/60;
            if (player.dashTimer <= 0) player.dash = false;
        }
        if (player.dashCooldown > 0) player.dashCooldown -= 1/60;
        
        // Salto normal y habilidades de salto
        if ((keys['Space'] || keys['KeyW']) && player.onGround) {
            if (playerForm === FORMS.NINJA) {
                player.vy = -18 * slowFactor;
                player.canDoubleJump = true;
            } else if (playerForm === FORMS.MAGO) {
                player.vy = -15 * slowFactor;
                player.levitating = true;
                player.levitateTimer = 0;
            } else {
                player.vy = -12 * slowFactor;
            }
            player.onGround = false;
        }

        // Doble salto Ninja
        if (playerForm === FORMS.NINJA && (keys['Space'] || keys['KeyW']) && player.canDoubleJump && !player.onGround) {
            player.vy = -16 * slowFactor;
            player.canDoubleJump = false;
        }

        // Levitación Mago
        if (playerForm === FORMS.MAGO && !player.onGround) {
            if (keys['Space'] && player.levitateTimer < 2) {
                player.vy = Math.max(player.vy, 0 * slowFactor);
                player.levitateTimer += 1/60;
            } else {
                player.vy += 0.8 * slowFactor;
            }
        } else {
            player.levitateTimer = 0;
        }

        // Plataformas mágicas (Mago)
        if (playerForm === FORMS.MAGO && keys['KeyE'] && player.platformCooldown <= 0) {
            player.platforms.push({ x: player.x, y: player.y+player.h+8, w: 80, h: 16, timer: 2 });
            player.platformCooldown = 1.5;
        }
        if (player.platformCooldown > 0) player.platformCooldown -= 1/60;
        player.platforms.forEach(p => p.timer -= 1/60);
        player.platforms = player.platforms.filter(p => p.timer > 0);

        // Tiempo lento (Mago)
        if (playerForm === FORMS.MAGO && keys['KeyQ'] && player.slowTimeCooldown <= 0) {
            player.slowTimeActive = true;
            player.slowTimeCooldown = 3;
            setTimeout(()=>{player.slowTimeActive=false;},1200);
        }
        if (player.slowTimeCooldown > 0) player.slowTimeCooldown -= 1/60;
        
        // Actualizar posición
        if (!player.onGround && playerForm !== FORMS.MAGO) player.vy += 0.6;
        player.x += player.vx;
        player.y += player.vy;
        
        // Colisiones con elementos
        player.onGround = false;
        caveElements.forEach(el => {
            if (el.type === 'ground' && collide(player, el)) {
                player.y = el.y - player.h;
                player.vy = 0;
                player.onGround = true;
            }
            
            // Activar cristal
            else if (el.type === 'crystal' && !crystalActivated) {
                let dx = Math.abs((player.x + player.w/2) - (el.x + el.w/2));
                if (dx < 200) {
                    crystalActivated = true;
                    caveCamera.lightRadius = 400;
                }
            }
            
            // Activar palanca
            else if (el.type === 'lever' && !el.activated) {
                if (collide(player, el) && keys['KeyE']) {
                    el.activated = true;
                    leverPulled = true;
                }
            }
            
            // Activar carrito
            else if (el.type === 'cart' && el.locked) {
                if (collide(player, el)) {
                    if (!leverPulled) {
                        // Mostrar mensaje de que necesita activar la palanca primero
                        ctx.save();
                        ctx.fillStyle = '#fff';
                        ctx.textAlign = 'center';
                        ctx.font = '20px Arial';
                        ctx.fillText('¡Necesitas activar la palanca primero!', canvas.width/2, 100);
                        ctx.restore();
                    } else if (playerForm === FORMS.DESTRUCTOR && keys['KeyE']) {
                        el.locked = false;
                        cartActivated = true;
                        setTimeout(() => {
                            cartRiding = true;
                            player.x = el.x + 20;
                            player.y = el.y;
                            cartPosition = { x: el.x, y: el.y, speed: 2 };
                            // Generar murciélagos perseguidores
                            bats = Array.from({length: 5}, (_, i) => ({
                                x: el.x - 500 - i*100,
                                y: 200 + Math.random()*200,
                                speed: 3 + Math.random()*2
                            }));
                        }, 1000);
                    }
                }
            }
        });
        
        // Límites y cámara
        if (player.x < 0) player.x = 0;
        if (player.x + player.w > level3Width) player.x = level3Width - player.w;
        if (player.y + player.h > canvas.height) {
            player.y = canvas.height - player.h;
            player.vy = 0;
            player.onGround = true;
        }
        caveCamera.x = Math.max(0, Math.min(player.x - canvas.width/3, level3Width - canvas.width));
    } 
    else {
        // Modo carrito
        cartPosition.speed *= playerForm === FORMS.DESTRUCTOR ? 0.99 : 1.01;
        cartPosition.speed = Math.max(2, Math.min(cartPosition.speed, 15));
        cartPosition.x += cartPosition.speed;
        
        // Actualizar posición del jugador con el carrito
        player.x = cartPosition.x + 20;
        player.y = cartPosition.y;
        
        // Actualizar murciélagos
        bats.forEach(bat => {
            bat.x += bat.speed;
            // Movimiento sinusoidal
            bat.y = 200 + Math.sin(Date.now()/500 + bat.x/100)*50;
        });
        
        // Verificar si los murciélagos alcanzaron al jugador
        if (bats.some(bat => bat.x > player.x - 50)) {
            resetLevel();
            return;
        }
        
        // Mover cámara con el carrito
        caveCamera.x = Math.max(0, Math.min(cartPosition.x - canvas.width/3, level3Width - canvas.width));
        
        // Verificar victoria al llegar al final
        if (cartPosition.x > level3Width - 200) {
            state = GAME_STATE.WIN;
        }
    }
}

// === LOOP PRINCIPAL ===
function gameLoop() {
	if (state === GAME_STATE.MENU) drawMenu();
	else if (state === GAME_STATE.LEVEL_SELECT) drawLevelSelect();
	else if (state === GAME_STATE.CONTROLS) drawControls();
	else if (state === GAME_STATE.OPTIONS) drawOptions();
	else if (state === GAME_STATE.PLAYING) {
		if (currentLevel === 0) {
			if (showTutorial) drawLevel1();
			else {
				updatePlayerLab();
				drawLevel1();
			}
		} else if (currentLevel === 1) {
			updatePlayerBosque();
			drawLevel2();
		} else if (currentLevel === 2) {
            updateLevel3();
            drawLevel3();
        }
	}
	else if (state === GAME_STATE.WIN) drawWin();
	requestAnimationFrame(gameLoop);
}
gameLoop();

// === INPUTS DE MENÚ Y NAVEGACIÓN ===
canvas.addEventListener('mousemove', function(e) {
	window._menuMouseY = e.offsetY;
});
canvas.addEventListener('mouseleave', function(e) {
	window._menuMouseY = -1;
});
canvas.addEventListener('click', function(e) {
	const mx = e.offsetX, my = e.offsetY;
	if (state === GAME_STATE.MENU) {
		if (my > 304 && my < 376) state = GAME_STATE.LEVEL_SELECT;
		if (my > 374 && my < 446) state = GAME_STATE.CONTROLS;
		if (my > 444 && my < 516) state = GAME_STATE.OPTIONS;
		if (my > 514 && my < 586) window.close();
	} else if (state === GAME_STATE.LEVEL_SELECT) {
		// Botón desbloquear todo
		if (mx > canvas.width-220 && mx < canvas.width-20 && my > 20 && my < 70) {
			levels.forEach((lvl, i) => {
				if (i > 0) lvl.unlocked = true;
			});
			return;
		}
		levels.forEach((lvl, i) => {
			let x = 180 + i*360;
			let pathY = 220 + Math.sin(Date.now()/600+i)*18;
			if (lvl.unlocked && Math.hypot(mx-x, my-pathY) < 54) {
				currentLevel = i;
				if (i === 0) {
					state = GAME_STATE.PLAYING;
					showTutorial = true;
					resetPlayer();
					collectedGem = false;
				} else if (i === 1) {
					state = GAME_STATE.PLAYING;
					showTutorial = false;
					resetPlayer();
					collectedGem = false;
					// Reiniciar cámara y estado de ramas
					cameraX = 0;
					ramasEstado = {};
				} else if (i === 2) {
					// Iniciar Nivel 3: La Cueva Profunda
					state = GAME_STATE.PLAYING;
					showTutorial = false;
					resetPlayer();
					collectedGem = false;
					// Resetear cámara y estados específicos de la cueva
					caveCamera.x = 0;
					caveCamera.lightRadius = 150;
					crystalActivated = false;
					leverPulled = false;
					cartActivated = false;
					cartRiding = false;
					cartPosition = { x: 1200, y: canvas.height-100, speed: 0 };
					bats = [];
					// Resetear elementos de la cueva (bloqueos, palancas y paths)
					caveElements.forEach(el => {
						if (el.type === 'cart') el.locked = true;
						if (el.type === 'lever') el.activated = false;
						if (el.type === 'path') {
							el.safe = Math.random() > 0.5;
							el.obstacles = Array.from({length: Math.floor(Math.random()*3+1)}, () => ({ x: Math.random()*400, type: Math.random() > 0.5 ? 'plank' : 'rock' }));
						}
					});
				}
			}
		});
		if (mx > 110 && mx < 330 && my > canvas.height-116 && my < canvas.height-64) state = GAME_STATE.MENU;
	} else if (state === GAME_STATE.CONTROLS) {
		if (mx > 110 && mx < 330 && my > 464 && my < 520) state = GAME_STATE.MENU;
	} else if (state === GAME_STATE.OPTIONS) {
		if (mx > 110 && mx < 330 && my > 464 && my < 520) state = GAME_STATE.MENU;
	}
});

window.addEventListener('keydown', function(e) {
	if (state === GAME_STATE.PLAYING && showTutorial && e.code === 'Enter') showTutorial = false;
	if (state === GAME_STATE.WIN && e.code === 'Enter') state = GAME_STATE.LEVEL_SELECT;
	// Cambiar forma
	if (state === GAME_STATE.PLAYING && !showTutorial) {
		if (e.code === 'Digit1') playerForm = FORMS.DESTRUCTOR;
		if (e.code === 'Digit2') playerForm = FORMS.NINJA;
		if (e.code === 'Digit3') playerForm = FORMS.MAGO;
	}
});
