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
	CINEMATIC: 'cinematic',
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
	{ name: 'Bosque Exterior', unlocked: false },
	{ name: 'Cueva de las Hadas', unlocked: false },
];
let currentLevel = 0;

// === FORMAS DEL PERSONAJE ===
const FORMS = {
	DESTRUCTOR: 'destructor',
	NINJA: 'ninja',
	MAGO: 'mago',
	DRUIDA: 'druida',
};
let playerForm = FORMS.DESTRUCTOR;

// === SISTEMA DE ESTÉTICA DE PERSONAJES ===
const PLAYER_AESTHETICS = {
	CLASICAS: 'clasicas',
	DISTINTIVAS: 'distintivas', 
	PALIDAS: 'palidas',
	RUNICAS: 'runicas'
};
let currentAesthetic = PLAYER_AESTHETICS.CLASICAS;

// Guardar/cargar estética seleccionada
function saveAesthetic() {
	try {
		localStorage.setItem('playerAesthetic', currentAesthetic);
	} catch (e) {}
}
function loadAesthetic() {
	try {
		const saved = localStorage.getItem('playerAesthetic');
		if (saved) {
			let migrated = saved;
			if (saved === 'inventada') migrated = PLAYER_AESTHETICS.RUNICAS; // migración
			if (Object.values(PLAYER_AESTHETICS).includes(migrated)) currentAesthetic = migrated;
		}
	} catch (e) {}
}
loadAesthetic();


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
	// Druida variables
	rootVineCooldown: 0,
	vineTargetX: 0,
	vineTargetY: 0,
	vineActive: false,
	vineStartX: 0,
	vineStartY: 0,
	// Control salto extra Ninja
	extraNinjaJumpUsed: false,
	// Embestida temporizada
	embestidaTimer: 0, // tiempo restante activo
	embestidaFatigue: 0, // tiempo restante de cansancio
	embestidaCooldown: 0, // no usar durante fatiga
	// (popup spiderSenseMessages removido; ahora HUD dinámico)
};

// === INPUTS & KEY BINDINGS ===
const keys = {};
window.addEventListener('keydown', e => { keys[e.code] = true; });
window.addEventListener('keyup', e => { keys[e.code] = false; });

// Sistema de acciones -> teclas (permite re-asignar en el menú de controles)
// Acciones soportadas: move_left, move_right, move_up (salto), form1..4, ability_primary (E), ability_secondary (Q), jump, levitate
const DEFAULT_KEY_BINDINGS = {
	move_left: ['ArrowLeft','KeyA'],
	move_right: ['ArrowRight','KeyD'],
	jump_basic: ['KeyW'],         // Saltar (antes W)
	hero_jump: ['Space'],         // Salto de héroe / levitar (antes Space)
	form1: ['Digit1'],
	form2: ['Digit2'],
	form3: ['Digit3'],
	form4: ['Digit4'],
	ability_secondary: ['KeyQ'], // Q habilidad movilidad / tiempo lento según forma
	ability_primary: ['KeyE']    // E habilidad héroe / interacción
	// Nota: acción antigua 'jump' migrada a jump_basic + hero_jump
};
let keyBindings = {};
function loadKeyBindings() {
	try {
		const saved = localStorage.getItem('shapeShiftKeyBindings');
		if (saved) {
			const data = JSON.parse(saved);
			// Migración: si existía 'jump', distribuirla
			if (data.jump && !data.jump_basic && !data.hero_jump) {
				// Usa primer código como hero_jump si era Space, resto a jump_basic
				let list = Array.isArray(data.jump) ? data.jump : [data.jump];
				keyBindings = { ...DEFAULT_KEY_BINDINGS };
				if (list.includes('Space')) keyBindings.hero_jump = ['Space'];
				if (list.length>0) keyBindings.jump_basic = list.filter(c=>c!=='Space');
				if (keyBindings.jump_basic.length===0) keyBindings.jump_basic = DEFAULT_KEY_BINDINGS.jump_basic.slice();
				// Copiar otras acciones
				Object.keys(data).forEach(k=>{ if (k!=='jump') keyBindings[k]=data[k]; });
			} else {
				keyBindings = { ...DEFAULT_KEY_BINDINGS, ...data };
			}
		} else {
			keyBindings = { ...DEFAULT_KEY_BINDINGS };
		}
	} catch (e) {
		keyBindings = { ...DEFAULT_KEY_BINDINGS };
	}
}
function saveKeyBindings() {
	try { localStorage.setItem('shapeShiftKeyBindings', JSON.stringify(keyBindings)); } catch (e) {}
}
loadKeyBindings();

function isActionPressed(action) {
	const list = keyBindings[action];
	if (!list) return false;
	for (let code of list) if (keys[code]) return true;
	return false;
}

// Utilidad para reasignar (se usará en menú de controles posteriormente)
function rebindAction(action, newCode) {
	if (!keyBindings[action]) return false;
	keyBindings[action] = [newCode];
	saveKeyBindings();
	return true;
}

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
	// Tubos verticales y luces alineadas con 4 héroes
	let heroPositions = [canvas.width/2-300, canvas.width/2-100, canvas.width/2+100, canvas.width/2+300];
	let heroColors = ['#ff2e2e','#2e8bff','#ffe359','#2eff2e'];
	for (let i=0;i<heroPositions.length;i++) {
		ctx.save();
		ctx.globalAlpha = 0.10;
		ctx.fillStyle = heroColors[i];
		ctx.fillRect(heroPositions[i]-8, 0, 16, canvas.height);
		ctx.restore();
	}
	// Luces circulares debajo de cada héroe
	let t = Date.now()/600;
	for (let i=0;i<heroPositions.length;i++) {
		ctx.save();
		ctx.globalAlpha = 0.20 + 0.07*Math.sin(t+i*1.7);
		ctx.beginPath();
		ctx.arc(heroPositions[i], 180+18*Math.sin(t+i), 78, 0, Math.PI*2);
		ctx.fillStyle = heroColors[i];
		ctx.shadowColor = heroColors[i];
		ctx.shadowBlur = 42;
		ctx.fill();
		ctx.restore();
	}
	// Representación de los 4 héroes
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
	drawHero(canvas.width/2-100, 180, '#2e8bff', '#0033a8');
	drawHero(canvas.width/2+100, 180, '#ffe359', '#bba800');
	drawHero(canvas.width/2+300, 180, '#2eff2e', '#00aa00');
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
let _rebindAction = null; // acción actualmente seleccionada para cambiar
function drawControls() {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	// Fondo con malla y gradiente dinámico
	let grad = ctx.createLinearGradient(0,0,0,canvas.height);
	grad.addColorStop(0,'#101522');
	grad.addColorStop(1,'#1d2e48');
	ctx.fillStyle = grad; ctx.fillRect(0,0,canvas.width,canvas.height);
	// Patrón tenue
	ctx.save(); ctx.globalAlpha=0.08; ctx.strokeStyle='#2e8bff';
	for(let x=0;x<canvas.width;x+=80){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke();}
	for(let y=0;y<canvas.height;y+=80){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke();}
	ctx.restore();
	drawText('CONTROLES & REASIGNACIÓN', canvas.width/2, 70, 48, '#ffe359');
	if (_rebindAction) drawText('Presiona una nueva tecla para: '+_rebindAction, canvas.width/2, 120, 24, '#ff8888');

	// Lista de acciones
	const actionLabels = [
		{a:'move_left', label:'Mover Izquierda'},
		{a:'move_right', label:'Mover Derecha'},
		{a:'jump_basic', label:'Saltar (W)'},
		{a:'hero_jump', label:'Salto de Héroe (Space)'},
		{a:'form1', label:'Forma 1 Destructor'},
		{a:'form2', label:'Forma 2 Ninja'},
		{a:'form3', label:'Forma 3 Mago'},
		{a:'form4', label:'Forma 4 Druida'},
		{a:'ability_primary', label:'Habilidad Héroe (E)'},
		{a:'ability_secondary', label:'Habilidad Movilidad (Q)'}
	];
	let startY = 170;
	actionLabels.forEach((row,i)=>{
		let y = startY + i*48;
		let hovered = window._menuMouseY>y-30 && window._menuMouseY<y+10;
		ctx.save();
		ctx.globalAlpha = hovered?0.9:0.65;
		ctx.fillStyle = (_rebindAction===row.a)?'#ff2e2e':(hovered?'#2e8bff':'#203248');
		ctx.shadowColor = (_rebindAction===row.a)?'#ff5555':'#2e8bff';
		ctx.shadowBlur = hovered?20:8;
		ctx.fillRect(canvas.width/2-360, y-34, 720, 44);
		ctx.restore();
		drawText(row.label, canvas.width/2-300, y-6, 24, '#ffe359','left');
		let binding = keyBindings[row.a] ? keyBindings[row.a].join(', ') : '-';
		drawText(binding, canvas.width/2+300, y-6, 24, '#fff','right');
	});
	drawText('Click en una fila para cambiar tecla', canvas.width/2, startY + actionLabels.length*48 + 20, 20, '#fff');
	drawText('R para restaurar valores por defecto', canvas.width/2, startY + actionLabels.length*48 + 50, 18, '#ff8888');
	drawText('← VOLVER', 120, canvas.height-80, 32, '#ffe359','left');
}

// === MENÚ DE OPCIONES ===
function drawOptions() {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	
	// Fondo futurista con degradado dinámico
	let grad = ctx.createLinearGradient(0,0,canvas.width,canvas.height);
	grad.addColorStop(0, '#0a0a1a');
	grad.addColorStop(0.3, '#1a1a2e');
	grad.addColorStop(0.7, '#16213e');
	grad.addColorStop(1, '#0f0f23');
	ctx.fillStyle = grad;
	ctx.fillRect(0,0,canvas.width,canvas.height);
	
	// Patrón de circuitos tecnológicos
	ctx.save();
	ctx.globalAlpha = 0.1;
	ctx.strokeStyle = '#2e8bff';
	ctx.lineWidth = 2;
	for(let x = 0; x < canvas.width; x += 100) {
		for(let y = 0; y < canvas.height; y += 100) {
			ctx.beginPath();
			ctx.rect(x, y, 50, 50);
			ctx.moveTo(x + 25, y);
			ctx.lineTo(x + 25, y + 50);
			ctx.moveTo(x, y + 25);
			ctx.lineTo(x + 50, y + 25);
			ctx.stroke();
		}
	}
	ctx.restore();
	
	// Título principal
	ctx.save();
	ctx.shadowColor = '#ffe359';
	ctx.shadowBlur = 40;
	drawText('ESTÉTICA DE PERSONAJES', canvas.width/2, 80, 48, '#ffe359');
	ctx.restore();
	
	// Subtítulo
	drawText('Elige el estilo visual de tu héroe', canvas.width/2, 120, 24, '#2e8bff');
	
	// Panel de opciones
	let panelX = canvas.width/2 - 400;
	let panelY = 160;
	let panelW = 800;
	let panelH = 400;
	
	// Fondo del panel
	ctx.save();
	ctx.fillStyle = 'rgba(30, 30, 50, 0.8)';
	ctx.strokeStyle = '#2e8bff';
	ctx.lineWidth = 3;
	ctx.fillRect(panelX, panelY, panelW, panelH);
	ctx.strokeRect(panelX, panelY, panelW, panelH);
	ctx.restore();
	
	// Opciones de estética
	const aesthetics = [
		{
			key: PLAYER_AESTHETICS.CLASICAS,
			title: 'CLÁSICAS',
			desc: 'Los modelos originales con sus colores vibrantes',
			color: '#ffe359'
		},
		{
			key: PLAYER_AESTHETICS.DISTINTIVAS,
			title: 'DISTINTIVAS',
			desc: 'Con accesorios únicos y efectos temáticos',
			color: '#ff6bb9'
		},
		{
			key: PLAYER_AESTHETICS.PALIDAS,
			title: 'PÁLIDAS',
			desc: 'Versiones sin brillo con tonos apagados y aura gris',
			color: '#888888'
		},
		{
			key: PLAYER_AESTHETICS.RUNICAS,
			title: 'RÚNICAS',
			desc: 'Energía arcana, anillos rúnicos y símbolos flotantes',
			color: '#b977ff'
		}
	];
	
	let mouseY = window._menuMouseY || -1;
	let optionHeight = 80;
	let startY = panelY + 40;
	
	aesthetics.forEach((aesthetic, i) => {
		let optY = startY + i * optionHeight;
		let isSelected = currentAesthetic === aesthetic.key;
		let isHovered = mouseY > optY && mouseY < optY + optionHeight - 10;
		
		// Fondo de la opción
		ctx.save();
		if (isSelected) {
			ctx.fillStyle = 'rgba(46, 139, 255, 0.3)';
			ctx.strokeStyle = aesthetic.color;
			ctx.lineWidth = 3;
		} else if (isHovered) {
			ctx.fillStyle = 'rgba(255, 227, 89, 0.1)';
			ctx.strokeStyle = '#ffe359';
			ctx.lineWidth = 2;
		} else {
			ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
			ctx.strokeStyle = '#666';
			ctx.lineWidth = 1;
		}
		
		ctx.fillRect(panelX + 20, optY, panelW - 40, optionHeight - 10);
		ctx.strokeRect(panelX + 20, optY, panelW - 40, optionHeight - 10);
		ctx.restore();
		
		// Texto de la opción
		let textColor = isSelected ? aesthetic.color : (isHovered ? '#ffe359' : '#fff');
		drawText(aesthetic.title, panelX + 60, optY + 25, 28, textColor, 'left');
		drawText(aesthetic.desc, panelX + 60, optY + 50, 16, '#ccc', 'left');
		
		// Indicador de selección
		if (isSelected) {
			ctx.save();
			ctx.fillStyle = aesthetic.color;
			ctx.shadowColor = aesthetic.color;
			ctx.shadowBlur = 15;
			ctx.beginPath();
			ctx.arc(panelX + panelW - 60, optY + 35, 8, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();
		}
		
		// Vista previa del personaje
		drawCharacterPreview(panelX + panelW - 120, optY + 35, aesthetic.key, 0.6);
	});
	
	// Instrucciones
	drawText('Click para seleccionar estética', canvas.width/2, panelY + panelH + 40, 20, '#2e8bff');
	drawText('Los ojos rosas del Nivel 3 siempre aparecen automáticamente', canvas.width/2, panelY + panelH + 65, 16, '#ff6bb9');
	
	// Botón volver
	let volverY = canvas.height - 80;
	let volverHovered = mouseY > volverY - 30 && mouseY < volverY + 10;
	let scale = volverHovered ? 1.08 : 1.0;
	
	ctx.save();
	ctx.globalAlpha = 0.96;
	ctx.fillStyle = '#23243a';
	ctx.shadowColor = '#ffe359';
	ctx.shadowBlur = volverHovered ? 32 : 18;
	ctx.translate(120, volverY);
	ctx.scale(scale, scale);
	ctx.fillRect(-10, -30, 220, 50);
	ctx.restore();
	
	drawText('← VOLVER', 120, volverY, volverHovered ? 32 : 28, '#ffe359', 'left');
}

// Función auxiliar para dibujar vista previa del personaje
function drawCharacterPreview(x, y, aesthetic, scale = 1) {
	let tempForm = FORMS.DESTRUCTOR; // Usar destructor para la vista previa
	let tempAesthetic = currentAesthetic;
	currentAesthetic = aesthetic; // Cambiar temporalmente
	
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(scale, scale);
	
	// Dibujar una versión mini del personaje
	let previewPlayer = {
		x: -20, y: -20, w: 40, h: 40
	};
	
	drawPlayerWithAesthetic(previewPlayer, tempForm, false); // false = no efectos de cristal
	
	ctx.restore();
	currentAesthetic = tempAesthetic; // Restaurar
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
	{ type: 'panel', x: 80, y: canvas.height-200, w: 320, h: 40, text: '← → mover | W saltar | SPACE salto héroe' },
	// Muro frágil (Destructor) - mucho más alto
	{ type: 'wall', x: 480, y: canvas.height-600, w: 48, h: 520, fragile: true, text: 'Rompe el muro con E (Destructor)' },
	// Plataforma alta (Ninja) - movida más atrás y más arriba
	{ type: 'platform', x: 1100, y: canvas.height-520, w: 120, h: 20, text: 'Doble salto y dash (Ninja)' },
	// Gema secreta
	{ type: 'gem', x: 1220, y: canvas.height-560, w: 24, h: 24 },
	// Plataforma final (mucho más alta)
	{ type: 'platform', x: 1400, y: canvas.height-620, w: 120, h: 20, text: 'Plataforma final' },
	// Puerta de escape (flotando encima de la plataforma final)
	{ type: 'door', x: 1450, y: canvas.height-700, w: 64, h: 80, text: 'Rompe la puerta con E (Destructor)' },
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
		drawText('W: Saltar | SPACE: Salto de héroe', 220, 150, 24);
		drawText('1/2/3/4 para cambiar forma', 200, 180, 24);
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
	
	// Controles dinámicos (como en nivel 3)
	if (playerForm === FORMS.DESTRUCTOR) {
		drawText('Q: Embestida | E: Interactuar', canvas.width/2, canvas.height-20, 16, '#ff2e2e');
	} else if (playerForm === FORMS.NINJA) {
		drawText('Q: Dash | W: Doble salto | E: Interactuar', canvas.width/2, canvas.height-20, 16, '#2e8bff');
	} else if (playerForm === FORMS.MAGO) {
		drawText('Q: Tiempo lento | E: Plataforma', canvas.width/2, canvas.height-20, 16, '#ffe359');
	} else if (playerForm === FORMS.DRUIDA) {
		drawText('E: Cuerda de raíces | Q: Impulso verde', canvas.width/2, canvas.height-20, 16, '#2eff2e');
	}
}

function drawPlayer(cx = 0) {
	drawPlayerWithAesthetic(player, playerForm, (currentLevel === 2 && (player.crystalFusion || crystalActivated)), cx);
}

function drawPlayerWithAesthetic(playerObj, form, hasCrystalEffect = false, cx = 0) {
	let drawX = playerObj.x - (cx || 0);
	let drawY = playerObj.y;
	let color = '#fff';
	let glow = '#fff';
	let border = '#fff';
	let eyeColor = '#fff';
	let pulse = 1;
	
	// Colores base según la forma
	if (form === FORMS.DESTRUCTOR) { color = '#ff2e2e'; glow = '#ff2e2e'; border = '#a80000'; }
	if (form === FORMS.NINJA) { color = '#2e8bff'; glow = '#2e8bff'; border = '#0033a8'; }
	if (form === FORMS.MAGO) { color = '#ffe359'; glow = '#ffe359'; border = '#bba800'; }
	if (form === FORMS.DRUIDA) { color = '#2eff2e'; glow = '#2eff2e'; border = '#00aa00'; }
	
	// Aplicar estética seleccionada
	if (currentAesthetic === PLAYER_AESTHETICS.PALIDAS) {
		// Versión pálida: tonos apagados, sin brillo
		color = shadeColor(color, -80);  // Mucho más pálido
		glow = '#666666';  // Aura gris pálida
		border = shadeColor(border, -60);
		eyeColor = '#999999';  // Ojos grises
	} else if (currentAesthetic === PLAYER_AESTHETICS.DISTINTIVAS) {
		// Mantener colores originales para distintivas
		eyeColor = '#fff';
	} else if (currentAesthetic === PLAYER_AESTHETICS.RUNICAS) {
		// Estética rúnica: fusión arcana púrpura
		color = blendColors(color, '#b977ff', 0.35);
		glow = '#b977ff';
		border = '#5d2d9c';
		eyeColor = '#e9d1ff';
	} else {
		// Clásicas: mantener original
		eyeColor = '#fff';
	}
	
	// Efecto de cristal del nivel 3 (siempre se aplica independientemente de la estética)
	if (hasCrystalEffect) {
		eyeColor = '#ff9bcc';  // Ojos rosados obligatorios en nivel 3
		// Dar un ligero tint rosa manteniendo la estética
		if (currentAesthetic !== PLAYER_AESTHETICS.PALIDAS) {
			glow = blendColors(glow, '#ff6bb9', 0.3);
			color = blendColors(color, '#ff6bb9', 0.1);
			border = blendColors(border, '#ff6bb9', 0.2);
		}
	}
	
	ctx.save();

	// Para druida distintivo: dibujar mariposas detrás antes del cuerpo
	if (currentAesthetic === PLAYER_AESTHETICS.DISTINTIVAS && form === FORMS.DRUIDA) {
		drawDruidButterfliesBehind(drawX, drawY, playerObj);
	}
	
	// Aplicar efectos especiales según estética
	if (currentAesthetic === PLAYER_AESTHETICS.PALIDAS) {
		ctx.shadowColor = glow;
		ctx.shadowBlur = 8;  // Mucho menos brillo
	} else if (currentAesthetic === PLAYER_AESTHETICS.RUNICAS) {
		// Aura arcana pulsante con anillo rúnico exterior
		ctx.shadowColor = glow;
		ctx.shadowBlur = 46;
		let ringR = playerObj.w/2 + 12 + 3*Math.sin(Date.now()/400);
		ctx.save();
		ctx.globalAlpha = 0.25;
		ctx.strokeStyle = '#e9d1ff';
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.ellipse(drawX+playerObj.w/2, drawY+playerObj.h/2, ringR, ringR*0.9, 0, 0, Math.PI*2);
		ctx.stroke();
		ctx.restore();
	} else {
		// Pulsación especial si es mago distintivo
		if (currentAesthetic === PLAYER_AESTHETICS.DISTINTIVAS && form === FORMS.MAGO) {
			pulse = 0.55 + 0.45 * Math.sin(Date.now()/250);
			ctx.shadowColor = glow;
			ctx.shadowBlur = 20 + 28 * pulse;
		} else {
			ctx.shadowColor = glow;
			ctx.shadowBlur = 32;
		}
	}
	
	// Cuerpo principal
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.ellipse(drawX+playerObj.w/2, drawY+playerObj.h/2, playerObj.w/2, playerObj.h/2, 0, 0, Math.PI*2);
	ctx.fill();
	ctx.lineWidth = 4;
	ctx.strokeStyle = border;
	ctx.stroke();

	// Orbes mágicos para mago distintivo (se dibujan detrás parcialmente, pero encima del cuerpo para brillo sutil)
	if (currentAesthetic === PLAYER_AESTHETICS.DISTINTIVAS && form === FORMS.MAGO) {
		let centerX = drawX + playerObj.w/2;
		let centerY = drawY + playerObj.h/2;
		for (let i = 0; i < 6; i++) {
			let ang = (Date.now()/700) + i * (Math.PI * 2 / 6);
			let radius = 35 + 6 * Math.sin(Date.now()/500 + i);
			let ox = centerX + Math.cos(ang) * radius;
			let oy = centerY + Math.sin(ang) * (radius * 0.5);
			ctx.save();
			ctx.globalAlpha = 0.35 + 0.25 * Math.sin(Date.now()/300 + i);
			ctx.fillStyle = '#ffeec0';
			ctx.shadowColor = '#ffe359';
			ctx.shadowBlur = 12 + 8 * Math.sin(Date.now()/400 + i);
			ctx.beginPath();
			ctx.arc(ox, oy, 5, 0, Math.PI*2);
			ctx.fill();
			ctx.restore();
		}
	}

	// Símbolos rúnicos orbitando (todas las formas bajo estética rúnica)
	if (currentAesthetic === PLAYER_AESTHETICS.RUNICAS) {
		let cxp = drawX + playerObj.w/2;
		let cyp = drawY + playerObj.h/2;
		let baseR = playerObj.w/2 + 10;
		for (let i = 0; i < 5; i++) {
			let a = Date.now()/900 + i * (Math.PI*2/5);
			let rx = cxp + Math.cos(a) * (baseR + 4*Math.sin(Date.now()/600 + i));
			let ry = cyp + Math.sin(a) * (baseR*0.8 + 3*Math.sin(Date.now()/700 + i));
			ctx.save();
			ctx.translate(rx, ry);
			ctx.rotate(a*1.5);
			ctx.globalAlpha = 0.5 + 0.3*Math.sin(Date.now()/400 + i);
			ctx.strokeStyle = '#e9d1ff';
			ctx.lineWidth = 2;
			ctx.beginPath();
			// Dibujar un glifo simple (rombo con barra)
			ctx.moveTo(0, -6);
			ctx.lineTo(5, 0);
			ctx.lineTo(0, 6);
			ctx.lineTo(-5, 0);
			ctx.closePath();
			ctx.stroke();
			// Barra interior
			ctx.beginPath();
			ctx.moveTo(-3, 0);
			ctx.lineTo(3, 0);
			ctx.stroke();
			ctx.restore();
		}
	}
	
	// Dibujar accesorios distintivos
	if (currentAesthetic === PLAYER_AESTHETICS.DISTINTIVAS) {
		drawDistinctiveAccessories(drawX, drawY, playerObj, form);
	}
	
	// Ojos
	ctx.save();
	ctx.shadowBlur = 0;
	ctx.fillStyle = eyeColor;
	let eyeY = drawY+playerObj.h/2-8;
	ctx.beginPath();
	ctx.arc(drawX+playerObj.w/2-10, eyeY, 5, 0, Math.PI*2);
	ctx.arc(drawX+playerObj.w/2+10, eyeY, 5, 0, Math.PI*2);
	ctx.fill();
	ctx.restore();
	
	ctx.restore();
}

// Función para dibujar accesorios distintivos
function drawDistinctiveAccessories(x, y, playerObj, form) {
	ctx.save();
	let centerX = x + playerObj.w/2;
	let centerY = y + playerObj.h/2;
	
	if (form === FORMS.DESTRUCTOR) {
		// Destructor: Casco con cuernos
		ctx.strokeStyle = '#ff6666';
		ctx.lineWidth = 3;
		ctx.beginPath();
		// Cuerno izquierdo
		ctx.moveTo(centerX - 15, centerY - 25);
		ctx.lineTo(centerX - 20, centerY - 40);
		// Cuerno derecho
		ctx.moveTo(centerX + 15, centerY - 25);
		ctx.lineTo(centerX + 20, centerY - 40);
		ctx.stroke();
		
		// Partículas de fuego
		for (let i = 0; i < 3; i++) {
			ctx.fillStyle = `rgba(255, ${100 + Math.random()*100}, 0, 0.7)`;
			ctx.beginPath();
			ctx.arc(centerX + (Math.random()-0.5)*40, centerY + (Math.random()-0.5)*20, 2, 0, Math.PI*2);
			ctx.fill();
		}
	} else if (form === FORMS.NINJA) {
		// Ninja: Máscara y shurikens orbitales
		ctx.fillStyle = '#001133';
		ctx.beginPath();
		ctx.ellipse(centerX, centerY - 10, 20, 8, 0, 0, Math.PI*2);
		ctx.fill();
		
		// Shurikens orbitales
		let time = Date.now() / 1000;
		for (let i = 0; i < 2; i++) {
			let angle = time + i * Math.PI;
			let orbX = centerX + Math.cos(angle) * 35;
			let orbY = centerY + Math.sin(angle) * 25;
			
			ctx.save();
			ctx.translate(orbX, orbY);
			ctx.rotate(time * 3);
			ctx.strokeStyle = '#4d9fff';
			ctx.lineWidth = 2;
			ctx.beginPath();
			for (let j = 0; j < 4; j++) {
				let sAngle = (j * Math.PI/2);
				ctx.moveTo(0, 0);
				ctx.lineTo(Math.cos(sAngle) * 8, Math.sin(sAngle) * 8);
			}
			ctx.stroke();
			ctx.restore();
		}
	} else if (form === FORMS.MAGO) {
		// Mago: Sombrero mejorado grande con ala y degradado + brillo pulsante (estrella eliminada)
		let t = Date.now()/400;
		// Ala del sombrero
		ctx.save();
		ctx.fillStyle = '#3d2b00';
		ctx.shadowColor = '#ffe359';
		ctx.shadowBlur = 12 + 6 * Math.sin(t*2);
		ctx.beginPath();
		ctx.ellipse(centerX, centerY - 18, 36, 14, 0, 0, Math.PI*2);
		ctx.fill();
		ctx.restore();
		// Cono degradado
		let gradHat = ctx.createLinearGradient(centerX, centerY-90, centerX, centerY-18);
		gradHat.addColorStop(0, '#ffe8a0');
		gradHat.addColorStop(0.5, '#d6a832');
		gradHat.addColorStop(1, '#6b4a00');
		ctx.fillStyle = gradHat;
		ctx.beginPath();
		ctx.moveTo(centerX, centerY - 90); // punta más alta
		ctx.lineTo(centerX - 26, centerY - 18);
		ctx.lineTo(centerX + 26, centerY - 18);
		ctx.closePath();
		ctx.fill();
		// Banda del sombrero
		ctx.fillStyle = '#4b1d7a';
		ctx.fillRect(centerX - 20, centerY - 36, 40, 8);
		// Broche brillante
		ctx.save();
		ctx.fillStyle = '#ffef77';
		ctx.shadowColor = '#ffef77';
		ctx.shadowBlur = 16;
		ctx.beginPath();
		ctx.ellipse(centerX + 12, centerY - 32, 6, 6, 0, 0, Math.PI*2);
		ctx.fill();
		ctx.restore();
		// Aura titilante adicional alrededor del sombrero
		for (let i = 0; i < 3; i++) {
			ctx.save();
			ctx.globalAlpha = 0.18 + 0.12 * Math.sin(Date.now()/300 + i*2);
			ctx.fillStyle = '#ffe359';
			ctx.beginPath();
			ctx.ellipse(centerX, centerY - 45, 40 + i*8, 25 + i*5, 0, 0, Math.PI*2);
			ctx.fill();
			ctx.restore();
		}
	} else if (form === FORMS.DRUIDA) {
		// Druida: Solo corona de hojas (mariposas ahora detrás)
		ctx.strokeStyle = '#44dd44';
		ctx.lineWidth = 2;
		// Hojas en la cabeza
		for (let i = 0; i < 6; i++) {
			let angle = (i * Math.PI * 2) / 6;
			let leafX = centerX + Math.cos(angle) * 22;
			let leafY = centerY - 20 + Math.sin(angle) * 15;
			
			ctx.save();
			ctx.translate(leafX, leafY);
			ctx.rotate(angle);
			ctx.beginPath();
			ctx.ellipse(0, 0, 4, 8, 0, 0, Math.PI*2);
			ctx.stroke();
			ctx.restore();
		}
		
	}
	ctx.restore();
}

// Mariposas detrás del jugador (druida distintivo)
function drawDruidButterfliesBehind(drawX, drawY, playerObj) {
	let centerX = drawX + playerObj.w/2;
	let centerY = drawY + playerObj.h/2;
	let time = Date.now() / 1200;
	for (let i = 0; i < 2; i++) {
		let angle = time + i * Math.PI;
		let buttX = centerX + Math.cos(angle) * 40;
		let buttY = centerY + Math.sin(angle) * 25;
		// Siempre detrás: dibujar antes del cuerpo (ya se hace) y sin superposición frontal
		// Para lograr efecto de pasar detrás, no hacemos nada extra; el cuerpo los tapará.
		// Solo reducir alpha cuando la mariposa estaría "delante" (cuando cos(angle) > 0)
		let frontFactor = Math.cos(angle) > 0 ? 0.15 : 0.7;
		let sizeMod = Math.cos(angle) > 0 ? 0.7 : 1.0;
		ctx.save();
		ctx.translate(buttX, buttY);
		ctx.fillStyle = '#88ff88';
		ctx.globalAlpha = frontFactor;
		ctx.beginPath();
		ctx.ellipse(-3*sizeMod, -2*sizeMod, 4*sizeMod, 6*sizeMod, 0, 0, Math.PI*2);
		ctx.ellipse(3*sizeMod, -2*sizeMod, 4*sizeMod, 6*sizeMod, 0, 0, Math.PI*2);
		ctx.fill();
		ctx.restore();
	}
}

// Función auxiliar para mezclar colores
function blendColors(color1, color2, ratio) {
	try {
		let c1 = color1.replace('#','');
		let c2 = color2.replace('#','');
		if (c1.length === 3) c1 = c1.split('').map(ch => ch+ch).join('');
		if (c2.length === 3) c2 = c2.split('').map(ch => ch+ch).join('');
		
		let r1 = parseInt(c1.substr(0,2), 16);
		let g1 = parseInt(c1.substr(2,2), 16);
		let b1 = parseInt(c1.substr(4,2), 16);
		
		let r2 = parseInt(c2.substr(0,2), 16);
		let g2 = parseInt(c2.substr(2,2), 16);
		let b2 = parseInt(c2.substr(4,2), 16);
		
		let r = Math.round(r1 * (1-ratio) + r2 * ratio);
		let g = Math.round(g1 * (1-ratio) + g2 * ratio);
		let b = Math.round(b1 * (1-ratio) + b2 * ratio);
		
		return '#' + (r<<16 | g<<8 | b).toString(16).padStart(6,'0');
	} catch(e) {
		return color1;
	}
}

// Small utility to darken/lighten a hex color by percent (-100..100)
function shadeColor(hex, percent) {
	try {
		let c = hex.replace('#','');
		if (c.length === 3) c = c.split('').map(ch => ch+ch).join('');
		let num = parseInt(c,16);
		let r = (num >> 16) + percent;
		let g = ((num >> 8) & 0x00FF) + percent;
		let b = (num & 0x0000FF) + percent;
		r = Math.max(0, Math.min(255, r));
		g = Math.max(0, Math.min(255, g));
		b = Math.max(0, Math.min(255, b));
		return '#' + (r<<16 | g<<8 | b).toString(16).padStart(6,'0');
	} catch(e) { return hex; }
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

// === NIVEL 3: CUEVA DE LAS HADAS ===
const level3Width = canvas.width * 8;
let caveCamera = 0;
let crystalActivated = false;
let cartActivated = false;
let leverPulled = false;
let cavePhase = 'exploration'; // 'exploration', 'cart_cinematic', 'cart_ride'
let cartPosition = { x: 1200, y: canvas.height-120, speed: 0 };
let cartChoice = null; // 'left', 'right', null
let cartJumping = false;
let cartJumpHeight = 0;
let caveBats = [];
let caveObstacles = [];
let cartProgress = 0; // Progreso en el carrito (0-100)
let caveParticles = []; // Efectos de partículas
// Sistema de rampas (reemplaza cambios de vía): cada palanca levanta una rampa para saltar un pozo con pinchos
let rampLevers = [
	{ x: 3250, activated: false, rampWidth: 130, rampHeight: 90, pitWidth: 320, flightStarted: false, hyperStartOffset: -180 }, // Rampa más chica, curva empieza antes
	{ x: 6750, activated: false, rampWidth: 140, rampHeight: 100, pitWidth: 360, flightStarted: false, hyperStartOffset: -200 } // Rampa más chica, curva empieza antes
];
let cartFlight = null; // {startX,endX,progress,duration,maxHeight}
let cartDeathTimer = 0;
const CART_START_X = 1200;

// Nuevas variables para el minijuego mejorado
let cinematicTimer = 0;
let cinematicPhase = 'zoom_in'; // 'zoom_in', 'ready', 'countdown', 'start'
let cameraZoom = 1;
let cameraTargetZoom = 1;
let countdownTimer = 3;
let cartSpeedMultiplier = 1;
let batSwarm = []; // Enjambre de murciélagos persiguiendo
let fairyEnemies = []; // Hadas que bajan para atacar al carrito

// Cinematica épica final
let cinematicData = {
	active: false,
	phase: 'falling', // 'falling', 'suspense', 'rising'
	timer: 0,
	heroY: -100, // Comienza desde arriba de todo
	heroVelocity: 0,
	cartY: -200, // Carrito empieza aún más arriba
	cartVelocity: 0,
	particles: [],
	cameraY: 0
};

// Sistema de vías alternativas eliminado
let currentRailPath = 'single';
// Parámetros configurables del salto del carrito (aumentados drasticamente)
const CART_JUMP_ASCENT_RATE = 16; // base de ascenso (modulada por mantener W)
const CART_JUMP_MAX_HEIGHT = 220; // altura máxima aún mayor
const CART_JUMP_DESCENT_RATE = 6;  // caída todavía más lenta
const CART_JUMP_MIN_HOLD_HEIGHT = 90; // altura garantizada
const CART_JUMP_HOLD_BONUS = 10; // bonus por frame mientras mantienes W (limitado)

// Reporte de viabilidad del minijuego
let cartFeasibilityReport = null; // {maxJump, requiredMax, beams:[], stalactites:[], viable:boolean, adjustments:boolean}
let lastCountdownNumber = null; // para controlar ondas

// Función para calcular viabilidad del recorrido del carrito
function computeCartFeasibility() {
	let report = {
		maxJump: CART_JUMP_MAX_HEIGHT,
		requiredMax: 0,
		beams: [],
		stalactites: [],
		viable: true,
		adjustments: false
	};
	// Analizar obstáculos relevantes
	caveObstacles.forEach(o => {
		if (o.type === 'low_beam') {
			report.beams.push({ x: o.x, height: o.height });
			if (o.height > report.requiredMax) report.requiredMax = o.height;
		}
		if (o.type === 'stalactite') {
			// Umbral actual de lógica de muerte: requiere salto >=80
			report.stalactites.push({ x: o.x, required: 80 });
			if (80 > report.requiredMax) report.requiredMax = 80;
		}
	});
	if (report.requiredMax > report.maxJump) report.viable = false;
	return report;
}

// Reiniciar el Level 3 completo
function restartLevel3() {
	// Reiniciar variables del nivel 3
	cavePhase = 'exploration';
	crystalActivated = false;
	leverPulled = false;
	cartActivated = false;
	cinematicTimer = 0;
	cinematicPhase = 'zoom_in';
	caveCamera = 0;
	
	// Reiniciar posición del jugador
	player.x = 50;
	player.y = 300;
	player.vx = 0;
	player.vy = 0;
	player.health = 100;
	player.crystalFusion = false;
	player.crystalFusionTimer = 0;
	
	// Reiniciar elementos del nivel
	caveElements.forEach(el => {
		if (el.type === 'crystal') {
			el.activated = false;
			el.visible = true; // Hacer visible el cristal de nuevo
		}
		if (el.type === 'lever') {
			el.pulled = false;
		}
		if (el.type === 'cart') {
			el.activated = false;
		}
	});
	
	// Reinicializar hadas y otros elementos
	initCaveBats();
	caveParticles = [];
	batSwarm = [];
	fairyEnemies = [];
	
	// Reiniciar palancas de las rampas - NUEVO
	rampLevers.forEach(lever => {
		lever.activated = false;
		lever.flightStarted = false;
	});
}

// Ajustar obstáculos si no es viable (reduce alturas de vigas demasiado altas)
function adjustObstaclesForFeasibility(report) {
	if (report.viable) return report;
	let changed = false;
	caveObstacles.forEach(o => {
		if (o.type === 'low_beam' && o.height > CART_JUMP_MAX_HEIGHT) {
			o.height = CART_JUMP_MAX_HEIGHT - 5; // margen
			changed = true;
		}
	});
	if (changed) {
		// Recalcular
		report = computeCartFeasibility();
		report.adjustments = true;
	}
	return report;
}

// Inicializar murciélagos de la cueva
function initCaveBats() {
	caveBats = [];
	for(let i = 0; i < 3; i++) { // Reducido nuevamente: ahora 3 hadas
		caveBats.push({
			x: 300 + i * 250 + Math.random() * 100,
			y: 50 + Math.random() * 100,
			vx: (Math.random() - 0.5) * 2,
			vy: (Math.random() - 0.5) * 2,
			active: true,
			chasing: false,
			hitbox: { width: 25, height: 25 } // Hitbox para colisión letal
		});
	}
}

// Inicializar enjambre de hadas para persecución épica
function initBatSwarm() {
	batSwarm = [];
	// Enjambre reducido de hadas (menos presión)
	for(let i = 0; i < 6; i++) {
		batSwarm.push({
			x: cartPosition.x - 400 - Math.random() * 250,
			y: 60 + Math.random() * 140,
			vx: 2 + Math.random() * 1.5,
			vy: (Math.random() - 0.5) * 1.5,
			baseSpeed: 2 + Math.random() * 1.5,
			swarmIndex: i,
			attackMode: false,
			size: 8 + Math.random() * 4,
			wingPhase: Math.random()*Math.PI*2,
			glowPhase: Math.random()*Math.PI*2,
			color: `hsl(${300 + Math.random()*40}, 80%, 72%)`,
			activationTimer: Math.random() * 5 + 3 // Salen mucho antes (3-8s)
		});
	}
}

function initFairyEnemies() {
	// Pre-crear dos espacios para hadas con estado inactivo. Serán activadas en momentos concretos.
	fairyEnemies = [
		{ active:false, phase:'idle' },
		{ active:false, phase:'idle' }
	];
	// Eliminamos hadas iniciales - ahora se generarán desde el enjambre
}

// Inicializar palancas de vías reposicionadas para coincidir con secciones
function initRailSwitches() {
	railSwitches = [
		{ x: 3400, y: canvas.height-200, active: false, triggered: false, section: 'switch1' },
		{ x: 6900, y: canvas.height-200, active: false, triggered: false, section: 'switch2' }
	];
}

// Inicializar caminos de vías
// initRailPaths eliminado (no más bifurcaciones)

// Inicializar obstáculos del carrito con espaciado épico y progresión clara
function initCartObstacles() {
	// Patrón épico con mucho espacio: Salto → Switch → Destruir → Salto alto → Switch → Destruir → Final
	// Cada sección tiene 1000-1400px de separación para respirar
	caveObstacles = [
		// SECCIÓN 1: Salto de maderas (x: 2000-2200)
		{ type: 'low_beam', x: 2000, y: canvas.height-180, height: 50, section: 'jump1' },
		{ type: 'low_beam', x: 2950, y: canvas.height-185, height: 55, section: 'jump1' },
		
		// RESPIRO: 1200px (2200 → 3400)
		
		// SECCIÓN 2: Switch de vías (x: 3400, manejado por railSwitches)
		
		// RESPIRO: 1000px (3400 → 4400)
		
		// SECCIÓN 3: Metal rojo destructible (x: 4400)
		{ type: 'breakable_rock', x: 4400, y: canvas.height-140, broken: false, size: 'large', section: 'destroy1' },
		
		// RESPIRO: 1200px (4400 → 5600)
		
		// SECCIÓN 4: Salto alto con estalactitas (x: 5600-5800)
		{ type: 'stalagmite', x: 5600, y: canvas.height-180, height: 140, section: 'jump_high1' },
		{ type: 'low_beam', x: 6075, y: canvas.height-190, height: 65, section: 'jump_high1' },
		
		// RESPIRO: 1100px (5800 → 6900)
		
		// SECCIÓN 5: Segundo switch (x: 6900, manejado por railSwitches)
		
		// RESPIRO: 1000px (6900 → 7900)
		
		// SECCIÓN 6: Metal final + salto combo (x: 7900-8100)
		{ type: 'breakable_rock', x: 7900, y: canvas.height-130, broken: false, size: 'large', section: 'destroy2' },
		{ type: 'low_beam', x: 8050, y: canvas.height-175, height: 48, section: 'final' }
	];
}

// updateSpiderSense eliminado (HUD nuevo)

// Función para dibujar la cuerda de raíces
function drawVine() {
	if (!player.vineActive) return;
	
	ctx.save();
	ctx.strokeStyle = '#2eff2e';
	ctx.lineWidth = 4;
	ctx.shadowColor = '#2eff2e';
	ctx.shadowBlur = 8;
	
	// Dibujar cuerda desde jugador hasta objetivo
	let startX = player.vineStartX - caveCamera;
	let startY = player.vineStartY;
	let endX = player.vineTargetX - caveCamera;
	let endY = player.vineTargetY;
	
	// Cuerda con curva natural
	ctx.beginPath();
	ctx.moveTo(startX, startY);
	let midX = (startX + endX) / 2;
	let midY = (startY + endY) / 2 + 30; // Curvatura
	ctx.quadraticCurveTo(midX, midY, endX, endY);
	ctx.stroke();
	
	// Efectos de raíces en el punto final
	ctx.fillStyle = '#2eff2e';
	ctx.globalAlpha = 0.7;
	for (let i = 0; i < 8; i++) {
		let angle = (i / 8) * Math.PI * 2;
		let rootX = endX + Math.cos(angle) * 15;
		let rootY = endY + Math.sin(angle) * 15;
		ctx.beginPath();
		ctx.arc(rootX, rootY, 3, 0, Math.PI * 2);
		ctx.fill();
	}
	
	ctx.restore();
}

// (Mensajes emergentes de sentido arácnido eliminados)

// Crear partículas para efectos visuales (con límite de performance)
let maxParticles = 120; // Límite global de partículas (reducido)
let PARTICLE_SCALE = 0.25; // Factor global para reducir drásticamente generación

function createCaveParticles(x, y, color, count = 5) {
	// Escalar cantidad solicitada
	count = Math.max(1, Math.floor(count * PARTICLE_SCALE));
	// Limitar el número de partículas nuevas si ya hay muchas
	if (caveParticles.length + count > maxParticles) {
		count = Math.max(0, maxParticles - caveParticles.length);
	}
	
	for(let i = 0; i < count; i++) {
		caveParticles.push({
			x: x + Math.random() * 20 - 10,
			y: y + Math.random() * 20 - 10,
			vx: (Math.random() - 0.5) * 4,
			vy: (Math.random() - 0.5) * 4 - 2,
			color: color,
			size: Math.random() * 6 + 2,
			life: 1.0,
			decay: Math.random() * 0.02 + 0.01
		});
	}
}

// Actualizar partículas (con cleanup optimizado)
function updateCaveParticles() {
	for (let i = caveParticles.length - 1; i >= 0; i--) {
		let p = caveParticles[i];
		p.x += p.vx;
		p.y += p.vy;
		p.vy += 0.1; // Gravedad
		p.life -= p.decay;
		p.size *= 0.99;
		
		// Remover partículas muertas
		if (p.life <= 0 || p.size <= 0.5) {
			caveParticles.splice(i, 1);
		}
	}
	
	// Cleanup adicional si hay demasiadas partículas
	if (caveParticles.length > maxParticles) {
		caveParticles.splice(0, caveParticles.length - maxParticles);
	}
}

// Dibujar partículas
function drawCaveParticles() {
	caveParticles.forEach(p => {
		let px = p.x - caveCamera;
		if (px > -50 && px < canvas.width + 50) {
			ctx.save();
			ctx.globalAlpha = p.life;
			ctx.fillStyle = p.color;
			ctx.beginPath();
			ctx.arc(px, p.y, p.size, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();
		}
	});
}

const caveElements = [
	// Suelo de la cueva
	{ type: 'ground', x: 0, y: canvas.height-80, w: level3Width, h: 80 },
	// Cristal activador rosa (posición más accesible)
	{ type: 'crystal', x: 900, y: canvas.height-150, w: 40, h: 60, activated: false, color: '#ff6bb9' },
	// Palanca muy alta (requiere druida)
	{ type: 'lever', x: 1250, y: canvas.height-600, pulled: false },
	// Carrito de minas
	{ type: 'cart', x: 1200, y: canvas.height-120, activated: false },
	// Rieles (terminan antes del pozo)
	{ type: 'rails', x: 1200, y: canvas.height-100, w: level3Width-1400, h: 10 },
	// Pozo al final en lugar de puerta
	{ type: 'pit', x: level3Width-300, y: canvas.height-80, w: 300, h: 200 }
];

function drawLevel3() {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	let time = Date.now()/600;

	// Fondo épico de cueva con capas de profundidad
	let deepGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
	deepGrad.addColorStop(0, '#02020a');
	deepGrad.addColorStop(0.3, '#05071a');
	deepGrad.addColorStop(0.7, '#0a0520');
	deepGrad.addColorStop(1, '#010105');
	ctx.fillStyle = deepGrad;
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	// Capas de atmósfera con parallax
	for(let layer = 0; layer < 2; layer++) {
		ctx.save();
		let offset = caveCamera * (0.05 + layer * 0.03);
		let fogGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
		fogGrad.addColorStop(0, `rgba(${20+layer*10},${10+layer*5},${40+layer*15},0.0${3-layer})`);
		fogGrad.addColorStop(1, 'rgba(0,0,0,0)');
		ctx.fillStyle = fogGrad;
		ctx.fillRect(-offset, 0, canvas.width + offset*2, canvas.height);
		ctx.restore();
	}

	// Título del nivel (si cristal no activado aún, para ambientar)
	if (!crystalActivated) {
		ctx.save();
		ctx.globalAlpha = 0.25 + Math.sin(time*1.2)*0.1;
		drawText('CUEVA DE LAS HADAS', canvas.width/2, 50, 42, '#ff6bb9');
		ctx.globalAlpha = 0.15 + Math.sin(time*1.2 + Math.PI/2)*0.1;
		drawText('Encuentra el cristal rosa', canvas.width/2, 90, 20, '#ff4a99');
		ctx.restore();
	}

	// Sistema de visión limitada antes del cristal vs visión completa después
	if (!crystalActivated) {
		// Oscuridad total excepto aura pequeña alrededor del jugador
		ctx.save();
		ctx.fillStyle = 'rgba(0,0,0,0.95)';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		
		// Aura pequeña del color del jugador
		let eyeColor = '#fff';
		if (playerForm === FORMS.DESTRUCTOR) eyeColor = '#ff2e2e';
		if (playerForm === FORMS.NINJA) eyeColor = '#2e8bff';
		if (playerForm === FORMS.MAGO) eyeColor = '#ffe359';
		if (playerForm === FORMS.DRUIDA) eyeColor = '#2eff2e';

		let playerScreenX = player.x - caveCamera;
		let playerScreenY = player.y;

		// Círculo de visión limitada
		let visionGrad = ctx.createRadialGradient(
			playerScreenX + player.w/2, playerScreenY + player.h/2, 0,
			playerScreenX + player.w/2, playerScreenY + player.h/2, 120
		);
		visionGrad.addColorStop(0, 'rgba(0,0,0,0)');
		visionGrad.addColorStop(0.7, 'rgba(0,0,0,0.3)');
		visionGrad.addColorStop(1, 'rgba(0,0,0,0.95)');
		ctx.globalCompositeOperation = 'destination-out';
		ctx.fillStyle = visionGrad;
		ctx.beginPath();
		ctx.arc(playerScreenX + player.w/2, playerScreenY + player.h/2, 120, 0, Math.PI*2);
		ctx.fill();
		ctx.restore();

		// Ojos brillantes
		ctx.save();
		ctx.shadowColor = eyeColor;
		ctx.shadowBlur = 15;
		ctx.fillStyle = eyeColor;
		ctx.beginPath();
		ctx.arc(playerScreenX + player.w/2 - 8, playerScreenY + player.h/2 - 8, 3, 0, Math.PI*2);
		ctx.arc(playerScreenX + player.w/2 + 8, playerScreenY + player.h/2 - 8, 3, 0, Math.PI*2);
		ctx.fill();
		ctx.restore();

		// Cristal débilmente brillante en la distancia (ahora rosa)
		let crystalElement = caveElements.find(el => el.type === 'crystal');
		if (crystalElement) {
			let crystalX = crystalElement.x - caveCamera;
			let distance = Math.sqrt((player.x + player.w/2 - (crystalElement.x + crystalElement.w/2))**2 + (player.y + player.h/2 - (crystalElement.y + crystalElement.h/2))**2);
			
			if (crystalX > -50 && crystalX < canvas.width + 50) {
				ctx.save();
				// Aumentar brillo cuando el jugador esté cerca
				let proximityAlpha = distance < 120 ? 0.8 + Math.sin(time*4)*0.2 : 0.3 + Math.sin(time*2)*0.1;
				ctx.globalAlpha = proximityAlpha;
				ctx.shadowColor = distance < 120 ? '#ff6bb9' : '#ff4a99';
				ctx.shadowBlur = distance < 120 ? 30 : 20;
				ctx.fillStyle = distance < 120 ? '#ff6bb9' : '#ff4a99';
				ctx.beginPath();
				ctx.arc(crystalX + crystalElement.w/2, crystalElement.y + crystalElement.h/2, distance < 120 ? 12 : 8, 0, Math.PI*2);
				ctx.fill();
				
				// Indicador de proximidad
				if (distance < 120) {
					ctx.globalAlpha = 0.5;
					ctx.strokeStyle = '#ff6bb9';
					ctx.lineWidth = 2;
					ctx.beginPath();
					ctx.arc(crystalX + crystalElement.w/2, crystalElement.y + crystalElement.h/2, 15 + Math.sin(time*6)*3, 0, Math.PI*2);
					ctx.stroke();
				}
				
				ctx.restore();
			}
		}

		// Mostrar plataformas del mago aunque esté oscuro (silhouette brillante)
		if (player.platforms && player.platforms.length>0) {
			player.platforms.forEach(p => {
				let px = p.x - caveCamera;
				if (px + p.w < -50 || px > canvas.width + 50) return;
				ctx.save();
				ctx.globalAlpha = 0.65;
				ctx.fillStyle = 'rgba(255,227,89,0.35)';
				ctx.strokeStyle = '#ffe359';
				ctx.lineWidth = 2;
				ctx.fillRect(px, p.y, p.w, p.h);
				ctx.strokeRect(px, p.y, p.w, p.h);
				ctx.restore();
			});
		}
		return;
	}

	// Una vez activado el cristal, mostrar la cueva iluminada con gráficos mejorados
	// Fondo de cueva con degradado épico y capas de luz sutil
	let caveGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
	caveGrad.addColorStop(0, '#030006');
	caveGrad.addColorStop(0.18, '#080519');
	caveGrad.addColorStop(0.45, '#0f0620');
	caveGrad.addColorStop(1, '#020204');
	ctx.fillStyle = caveGrad;
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	// Bloom suave central (tint rosado tenue) para que el cristal afecte la paleta
	let centerX = canvas.width/2 - (caveCamera%600)*0.05;
	let lightGrad = ctx.createRadialGradient(centerX, canvas.height*0.55, 0, centerX, canvas.height*0.55, canvas.width*0.9);
	lightGrad.addColorStop(0, 'rgba(255,100,170,0.06)');
	lightGrad.addColorStop(0.2, 'rgba(255,80,150,0.03)');
	lightGrad.addColorStop(1, 'rgba(0,0,0,0)');
	ctx.fillStyle = lightGrad;
	ctx.fillRect(0,0,canvas.width,canvas.height);

	// Oscurecer bordes de pantalla según proximidad al cristal (borde muy oscuro si lejos)
	let crystalEl = caveElements.find(el => el.type === 'crystal');
	let proximity = 0;
	if (crystalEl && crystalActivated) {
		let dx = (player.x + player.w/2) - (crystalEl.x + crystalEl.w/2);
		let dy = (player.y + player.h/2) - (crystalEl.y + crystalEl.h/2);
		let d = Math.hypot(dx, dy);
		proximity = Math.max(0, 1 - d/700);
	}
	
	// Sistema de iluminación por distancia: cerca del jugador se ve bien, lejos está oscuro
	ctx.save();
	let playerCenterX = player.x + player.w/2 - caveCamera;
	let playerCenterY = player.y + player.h/2;
	
	// Crear máscara de iluminación centrada en el jugador
	let lightRadius = 400 + proximity * 200;
	let playerLightGrad = ctx.createRadialGradient(
		playerCenterX, playerCenterY, 0,
		playerCenterX, playerCenterY, lightRadius
	);
	playerLightGrad.addColorStop(0, 'rgba(0,0,0,0)');
	playerLightGrad.addColorStop(0.3, 'rgba(0,0,0,0.1)');
	playerLightGrad.addColorStop(0.7, 'rgba(0,0,0,0.6)');
	playerLightGrad.addColorStop(1, 'rgba(0,0,0,0.95)');
	
	ctx.fillStyle = playerLightGrad;
	ctx.globalCompositeOperation = 'multiply';
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	
	// Vignette adicional en bordes de pantalla
	let vign = ctx.createRadialGradient(canvas.width/2, canvas.height/2, Math.max(canvas.width, canvas.height)*0.2, canvas.width/2, canvas.height/2, Math.max(canvas.width, canvas.height)*0.8);
	vign.addColorStop(0, 'rgba(0,0,0,0)');
	vign.addColorStop(1, 'rgba(0,0,0,0.9)');
	ctx.fillStyle = vign;
	ctx.fillRect(0,0,canvas.width,canvas.height);
	ctx.restore();

	// Formaciones rocosas más detalladas (optimizadas)
	ctx.save();
	for(let layer = 0; layer < 2; layer++) { // Reducido de 3 a 2 capas
		ctx.globalAlpha = 0.15 - layer * 0.05;
		let parallax = caveCamera * (0.08 + layer * 0.04);
		let spacing = 150; // Aumentado el espaciado
		for(let x = -parallax % spacing; x < canvas.width; x += spacing) {
			for(let y = layer * 40; y < canvas.height-80; y += 100) { // Menos elementos verticales
				ctx.fillStyle = layer === 0 ? '#444' : '#333';
				// Formas rocosas más simples para performance
				ctx.beginPath();
				ctx.moveTo(x, y);
				ctx.quadraticCurveTo(x + 40, y - 15, x + 80, y);
				ctx.quadraticCurveTo(x + 60, y + 25, x, y + 40);
				ctx.closePath();
				ctx.fill();
			}
		}
	}
	ctx.restore();

	// Cristales mejorados con más variación (optimizados)
	ctx.save();
	let crystalCount = Math.min(25, Math.floor(canvas.width / 50)); // Límite dinámico basado en ancho de pantalla
	for(let i = 0; i < crystalCount; i++) {
		let crystalWallX = (i * 400 + Math.sin(i*3)*60) - (caveCamera*0.12)%400;
		let crystalWallY = 80 + Math.sin(i*2.2)*100;
		let crystalSize = 3 + Math.sin(i*1.3) * 1.5;
		
		// Skip if off screen
		if (crystalWallX < -50 || crystalWallX > canvas.width + 50) continue;
		
		// Cristales con colores variados
		let crystalColors = ['#3e9bff', '#50f0ff', '#1066cc', '#76aaff'];
		ctx.shadowColor = crystalColors[i % 4];
		ctx.shadowBlur = 8 + Math.sin(time + i) * 4;
		ctx.fillStyle = crystalColors[i % 4];
		ctx.globalAlpha = 0.4 + Math.sin(time*1.2 + i)*0.25;
		
		// Forma de cristal más simple para performance
		ctx.beginPath();
		ctx.moveTo(crystalWallX, crystalWallY - crystalSize);
		ctx.lineTo(crystalWallX + crystalSize, crystalWallY);
		ctx.lineTo(crystalWallX, crystalWallY + crystalSize);
		ctx.lineTo(crystalWallX - crystalSize, crystalWallY);
		ctx.closePath();
		ctx.fill();
		
		// Brillo interno (solo en algunos cristales)
		if (i % 3 === 0) {
			ctx.globalAlpha = 0.5;
			ctx.fillStyle = '#ffffff';
			ctx.beginPath();
			ctx.arc(crystalWallX, crystalWallY, crystalSize * 0.25, 0, Math.PI*2);
			ctx.fill();
		}
	}
	ctx.restore();

	// Dibujar plataformas mágicas visibles (fase iluminada)
	if (player.platforms && player.platforms.length>0) {
		player.platforms.forEach(p => {
			let px = p.x - caveCamera;
			if (px + p.w < -50 || px > canvas.width + 50) return;
			ctx.save();
			ctx.globalAlpha = 0.85 * (p.timer/2); // se desvanecen con el tiempo
			let grad = ctx.createLinearGradient(px, p.y, px, p.y+p.h);
			grad.addColorStop(0,'#fff3a6');
			grad.addColorStop(1,'#ffe359');
			ctx.fillStyle = grad;
			ctx.fillRect(px, p.y, p.w, p.h);
			ctx.strokeStyle = '#d4b840';
			ctx.lineWidth = 2;
			ctx.strokeRect(px+1, p.y+1, p.w-2, p.h-2);
			ctx.restore();
		});
	}

	// Efecto de neblina volumétrica en capas para profundidad (simplificado)
	for (let layer=0; layer<2; layer++) { // Reducido de 3 a 2 capas
		ctx.save();
		let alpha = 0.04 + layer*0.015; // Reducido para menos overdraw
		let mistGradL = ctx.createLinearGradient(0, canvas.height*0.3 + layer*80, 0, canvas.height);
		mistGradL.addColorStop(0, `rgba(40,60,90,${alpha})`);
		mistGradL.addColorStop(1, `rgba(0,0,0,0)`);
		ctx.fillStyle = mistGradL;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.restore();
	}

	// Hadas de fondo en el techo (brillo etéreo) - optimizadas
	let visibleFairies = caveBats.filter(fairy => {
		let fx = fairy.x - caveCamera;
		return fx > -150 && fx < canvas.width + 150; // Pre-filtrar por visibilidad
	});
	
	visibleFairies.forEach(fairy => {
		let fx = fairy.x - caveCamera;
		ctx.save();
		// Animación ligera
		fairy.wingPhase = (fairy.wingPhase || 0) + 0.2; // Reducido para menos cálculo
		fairy.glowPhase = (fairy.glowPhase || 0) + 0.1;

		// Cuerpo principal con color etéreo
		let baseColor = fairy.color || `hsl(${300 + (fairy.colorHue||Math.random()*40)}, 80%, 70%)`;
		ctx.fillStyle = baseColor;
		ctx.globalAlpha = 0.8; // Reducido ligeramente
		ctx.beginPath();
		ctx.ellipse(fx, fairy.y, (fairy.size||10) * 0.5, (fairy.size||10) * 0.8, 0, 0, Math.PI*2);
		ctx.fill();

		// Alas blancas translúcidas (simplificadas)
		let wingSize = (fairy.size||10) * 1.0;
		let wingWobble = Math.sin(fairy.wingPhase) * 0.3;
		ctx.globalAlpha = 0.5;
		ctx.fillStyle = '#ffffff';
		ctx.beginPath();
		ctx.ellipse(fx - wingSize*0.5, fairy.y - wingSize*0.2 + wingWobble, wingSize*0.6, wingSize*0.8, -0.3, 0, Math.PI*2);
		ctx.fill();
		ctx.beginPath();
		ctx.ellipse(fx + wingSize*0.5, fairy.y - wingSize*0.2 - wingWobble, wingSize*0.6, wingSize*0.8, 0.3, 0, Math.PI*2);
		ctx.fill();

		// Halo brillante (simplificado)
		ctx.globalAlpha = 0.3 + Math.sin(fairy.glowPhase) * 0.1;
		ctx.fillStyle = baseColor;
		ctx.beginPath();
		ctx.arc(fx, fairy.y, (fairy.size||10) * 1.2, 0, Math.PI*2);
		ctx.fill();

		ctx.restore();
	});

	// Iluminación alrededor del jugador si el cristal está fusionado
	if (player.crystalFusion || crystalActivated) {
		ctx.save();
		let px = player.x + player.w/2 - caveCamera;
		let py = player.y + player.h/2;
		let radius = 220 + (player.crystalFusionTimer ? Math.max(0, player.crystalFusionTimer*20) : 0);
		let pGrad = ctx.createRadialGradient(px, py, 0, px, py, radius);
		pGrad.addColorStop(0, 'rgba(255,110,180,0.45)');
		pGrad.addColorStop(0.4, 'rgba(255,110,180,0.12)');
		pGrad.addColorStop(1, 'rgba(0,0,0,0)');
		ctx.globalCompositeOperation = 'lighter';
		ctx.fillStyle = pGrad;
		ctx.beginPath();
		ctx.arc(px, py, radius, 0, Math.PI*2);
		ctx.fill();
		ctx.restore();
	}

	// Elementos de la cueva
	caveElements.forEach(el => {
		let ex = el.x - caveCamera;
		if (ex + el.w < -100 || ex > canvas.width + 100) return;

		if (el.type === 'ground') {
			ctx.save();
			ctx.fillStyle = '#4a4a4a';
			ctx.fillRect(ex, el.y, el.w, el.h);
			// Textura del suelo
			ctx.globalAlpha = 0.2;
			for(let x = ex; x < ex + el.w; x += 40) {
				ctx.fillStyle = '#333';
				ctx.fillRect(x, el.y, 35, el.h);
			}
			ctx.restore();
		}

		if (el.type === 'crystal') {
			// Solo dibujar el cristal si no ha sido recogido
			if (el.visible !== false) {
				ctx.save();
				let intensity = crystalActivated ? 1 : 0.8;
				ctx.globalAlpha = intensity;
				// Color rosa para el cristal
				let crystalColor = el.color || '#ff6bb9';
				ctx.shadowColor = crystalColor;
				ctx.shadowBlur = 30 * intensity;
				
				// Cristal principal (usando posición y dimensiones correctas)
				let crystalCenterX = ex + el.w/2;
				let crystalCenterY = el.y + el.h/2;
				
				ctx.fillStyle = crystalActivated ? '#ff4a99' : crystalColor;
				ctx.beginPath();
				ctx.moveTo(crystalCenterX, el.y);
				ctx.lineTo(crystalCenterX+20, crystalCenterY);
				ctx.lineTo(crystalCenterX, el.y+el.h);
				ctx.lineTo(crystalCenterX-20, crystalCenterY);
				ctx.closePath();
				ctx.fill();

				// Efecto de brillo pulsante
				if (!crystalActivated) {
					let pulse = Math.sin(time*3) * 0.5 + 0.5;
					ctx.shadowBlur = (15 + pulse*15);
					ctx.fillStyle = `rgba(255,107,185,${pulse*0.5})`;
					ctx.fill();
				}

				// Luz irradiada cuando está activado
				if (crystalActivated) {
					let crystalLightGrad = ctx.createRadialGradient(crystalCenterX, crystalCenterY, 0, crystalCenterX, crystalCenterY, 200);
					crystalLightGrad.addColorStop(0, 'rgba(255,74,153,0.4)');
					crystalLightGrad.addColorStop(1, 'rgba(255,74,153,0)');
					ctx.fillStyle = crystalLightGrad;
					ctx.beginPath();
					ctx.arc(crystalCenterX, crystalCenterY, 200, 0, Math.PI*2);
					ctx.fill();
				}
				ctx.restore();
			}
		}

		if (el.type === 'platform') {
			ctx.save();
			ctx.fillStyle = '#666';
			ctx.fillRect(ex, el.y, el.w, el.h);
			ctx.strokeStyle = '#888';
			ctx.lineWidth = 2;
			ctx.strokeRect(ex, el.y, el.w, el.h);
			ctx.restore();
		}

		if (el.type === 'lever') {
			ctx.save();
			// Base de la palanca mejorada
			ctx.fillStyle = leverPulled ? '#777' : '#555';
			ctx.fillRect(ex-12, el.y, 24, 35);
			
			// Bordes de la base
			ctx.strokeStyle = leverPulled ? '#999' : '#333';
			ctx.lineWidth = 2;
			ctx.strokeRect(ex-12, el.y, 24, 35);
			
			// Palanca mejorada
			let leverAngle = leverPulled ? Math.PI/3 : -Math.PI/6;
			ctx.strokeStyle = leverPulled ? '#ff4444' : '#888';
			ctx.lineWidth = 6;
			ctx.beginPath();
			ctx.moveTo(ex, el.y+30);
			ctx.lineTo(ex + Math.cos(leverAngle)*30, el.y+30 + Math.sin(leverAngle)*30);
			ctx.stroke();

			// Mango mejorado
			ctx.fillStyle = leverPulled ? '#ff2e2e' : '#cc1111';
			if (leverPulled) {
				ctx.shadowColor = '#ff2e2e';
				ctx.shadowBlur = 10;
			}
			ctx.beginPath();
			ctx.arc(ex + Math.cos(leverAngle)*30, el.y+30 + Math.sin(leverAngle)*30, 8, 0, Math.PI*2);
			ctx.fill();
			
			// Detalle del mango
			ctx.fillStyle = leverPulled ? '#ffaaaa' : '#ff6666';
			ctx.beginPath();
			ctx.arc(ex + Math.cos(leverAngle)*30, el.y+30 + Math.sin(leverAngle)*30, 4, 0, Math.PI*2);
			ctx.fill();
			ctx.restore();

			if (!leverPulled) {
				drawText('Q: Jalar con cuerda druida', ex, el.y-10, 14, '#ff2e2e');
			} else {
				drawText('¡Activada!', ex, el.y-10, 14, '#ff2e2e');
			}
		}

		if (el.type === 'cart') {
			let cartX = cavePhase === 'cart_ride' ? cartPosition.x - caveCamera : ex;
			let cartY = cavePhase === 'cart_ride' ? cartPosition.y - cartJumpHeight : el.y;

			ctx.save();
			// Carrito mejorado
			ctx.fillStyle = leverPulled ? '#8B4513' : '#654321';
			ctx.fillRect(cartX, cartY, 60, 40);
			
			// Efectos de brillo cuando está activado
			if (leverPulled) {
				ctx.save();
				ctx.shadowColor = '#ff2e2e';
				ctx.shadowBlur = 15;
				ctx.globalAlpha = 0.7;
				ctx.fillStyle = '#ff4444';
				ctx.fillRect(cartX, cartY, 60, 40);
				ctx.restore();
			}
			
			// Ruedas mejoradas
			ctx.fillStyle = leverPulled ? '#ff2e2e' : '#333';
			ctx.beginPath();
			ctx.arc(cartX+15, cartY+40, 10, 0, Math.PI*2);
			ctx.arc(cartX+45, cartY+40, 10, 0, Math.PI*2);
			ctx.fill();
			
			// Radios de las ruedas
			if (leverPulled) {
				ctx.save();
				ctx.strokeStyle = '#ffaaaa';
				ctx.lineWidth = 2;
				let time = Date.now() / 100;
				for(let i = 0; i < 4; i++) {
					let angle = (i * Math.PI/2) + time;
					// Rueda izquierda
					ctx.beginPath();
					ctx.moveTo(cartX+15, cartY+40);
					ctx.lineTo(cartX+15 + Math.cos(angle)*8, cartY+40 + Math.sin(angle)*8);
					ctx.stroke();
					// Rueda derecha
					ctx.beginPath();
					ctx.moveTo(cartX+45, cartY+40);
					ctx.lineTo(cartX+45 + Math.cos(angle)*8, cartY+40 + Math.sin(angle)*8);
					ctx.stroke();
				}
				ctx.restore();
			}

			// Detalles del carrito mejorados
			ctx.strokeStyle = leverPulled ? '#ff2e2e' : '#333';
			ctx.lineWidth = 3;
			ctx.strokeRect(cartX+5, cartY+5, 50, 30);
			
			// Marco interno decorativo
			ctx.strokeStyle = leverPulled ? '#ffaaaa' : '#666';
			ctx.lineWidth = 1;
			ctx.strokeRect(cartX+8, cartY+8, 44, 24);

			if (!cartActivated && cavePhase === 'exploration') {
				let textColor = leverPulled ? '#ff2e2e' : '#fff';
				drawText(leverPulled ? 'Carrito listo (Destructor: E)' : 'Carrito trabado (Tirar palanca)', cartX+30, cartY-10, 14, textColor);
			}
			ctx.restore();
		}

		if (el.type === 'rails') {
			ctx.save();
			// Color de rieles según estado
			let railColor = '#666';
			let tieColor = '#444';
			
			// Inicio de los rieles (primeros 300px) se vuelve rojo si la palanca está activada
			if (leverPulled && ex < 300) {
				railColor = '#ff2e2e';
				tieColor = '#cc1111';
				ctx.shadowColor = '#ff2e2e';
				ctx.shadowBlur = 10;
			}
			
			ctx.strokeStyle = railColor;
			ctx.lineWidth = 4;
			// Rieles mejorados
			ctx.beginPath();
			ctx.moveTo(ex, el.y);
			ctx.lineTo(ex + el.w, el.y);
			ctx.moveTo(ex, el.y + 8);
			ctx.lineTo(ex + el.w, el.y + 8);
			ctx.stroke();

			// Traviesas mejoradas
			for(let x = ex; x < ex + el.w; x += 40) {
				ctx.fillStyle = tieColor;
				ctx.fillRect(x, el.y-4, 25, 16);
				// Detalles de las traviesas
				ctx.strokeStyle = leverPulled && x < ex + 300 ? '#ffaaaa' : '#666';
				ctx.lineWidth = 1;
				ctx.strokeRect(x+2, el.y-2, 21, 12);
			}
			ctx.restore();
		}

		if (el.type === 'door') {
			ctx.save();
			ctx.fillStyle = '#666';
			ctx.fillRect(ex, el.y, el.w, el.h);
			ctx.strokeStyle = '#2e8bff';
			ctx.lineWidth = 4;
			ctx.strokeRect(ex+5, el.y+5, el.w-10, el.h-10);
			drawText('Salida', ex+el.w/2, el.y-10, 16, '#2e8bff');
			ctx.restore();
		}

		if (el.type === 'pit') {
			ctx.save();
			// Pozo oscuro y profundo
			let pitGrad = ctx.createRadialGradient(ex + el.w/2, el.y + el.h/2, 0, ex + el.w/2, el.y + el.h/2, el.w/2);
			pitGrad.addColorStop(0, '#000');
			pitGrad.addColorStop(0.7, '#111');
			pitGrad.addColorStop(1, '#222');
			ctx.fillStyle = pitGrad;
			ctx.fillRect(ex, el.y, el.w, el.h);
			
			// Bordes rocosos del pozo
			ctx.strokeStyle = '#444';
			ctx.lineWidth = 8;
			ctx.strokeRect(ex, el.y, el.w, el.h);
			
			// Efectos de profundidad
			ctx.strokeStyle = '#666';
			ctx.lineWidth = 4;
			ctx.strokeRect(ex + 20, el.y + 20, el.w - 40, el.h - 40);
			
			drawText('POZO PROFUNDO', ex + el.w/2, el.y - 10, 16, '#ff6666');
			ctx.restore();
		}
	});

	// Dibujar obstáculos del carrito si estamos en esa fase
	if (cavePhase === 'cart_ride') {
		caveObstacles.forEach(obs => {
			let obsX = obs.x - caveCamera;
			if (obsX > -100 && obsX < canvas.width + 100) {
				if (obs.type === 'choice') {
					// Caminos: bueno vs roto
					ctx.save();
					// Camino izquierdo
					ctx.fillStyle = obs.correct === 'left' ? '#2e8bff' : '#ff2e2e';
					ctx.fillRect(obsX-50, canvas.height-100, 40, 100);
					// Camino derecho
					ctx.fillStyle = obs.correct === 'right' ? '#2e8bff' : '#ff2e2e';
					ctx.fillRect(obsX+50, canvas.height-100, 40, 100);
					
					drawText('A ←  → D', obsX, canvas.height-120, 16, '#fff');
					ctx.restore();
				}

				if (obs.type === 'low_beam') {
					ctx.save();
					
					// Dibujar sombra en el piso
					ctx.fillStyle = 'rgba(0,0,0,0.3)';
					ctx.beginPath();
					ctx.ellipse(obsX + 40, canvas.height - 5, 50, 8, 0, 0, Math.PI * 2);
					ctx.fill();
					
					// Madera principal con textura más realista
					let woodGrad = ctx.createLinearGradient(obsX, obs.y, obsX + 80, obs.y + 15);
					woodGrad.addColorStop(0, '#8B4513');
					woodGrad.addColorStop(0.3, '#A0522D');
					woodGrad.addColorStop(0.7, '#654321');
					woodGrad.addColorStop(1, '#4A2C15');
					
					ctx.fillStyle = woodGrad;
					ctx.fillRect(obsX, obs.y, 80, 15);
					
					// Vetas de madera
					ctx.strokeStyle = 'rgba(90, 50, 20, 0.6)';
					ctx.lineWidth = 1;
					for(let i = 0; i < 3; i++) {
						ctx.beginPath();
						ctx.moveTo(obsX + 10 + i * 20, obs.y + 2);
						ctx.lineTo(obsX + 70 + i * 5, obs.y + 13);
						ctx.stroke();
					}
					
					// Borde superior más claro (luz)
					ctx.fillStyle = '#D2B48C';
					ctx.fillRect(obsX, obs.y, 80, 2);
					
					// Extremos más oscuros para profundidad
					ctx.fillStyle = '#3E2723';
					ctx.fillRect(obsX, obs.y, 3, 15);
					ctx.fillRect(obsX + 77, obs.y, 3, 15);
					
					drawText('W: Saltar', obsX+40, obs.y-10, 14, '#fff');
					ctx.restore();
				}

				if (obs.type === 'breakable' && !obs.broken) {
					ctx.save();
					ctx.fillStyle = '#ff2e2e';
					ctx.fillRect(obsX, canvas.height-150, 60, 50);
					ctx.globalAlpha = 0.5;
					ctx.fillStyle = '#000';
					ctx.fillRect(obsX+10, canvas.height-140, 40, 30);
					drawText('E (Destructor)', obsX+30, canvas.height-160, 12, '#fff');
					ctx.restore();
				}

				// Nuevo pincho (stalagmite) desde el suelo
				if (obs.type === 'stalagmite') {
					ctx.save();
					let baseY = canvas.height - 80; // suelo
					let h = obs.height;
					let w = 70;
					ctx.shadowColor = '#855533';
					ctx.shadowBlur = 14;
					let grad = ctx.createLinearGradient(obsX, baseY - h, obsX, baseY);
					grad.addColorStop(0, '#a06a3c');
					grad.addColorStop(1, '#5a341b');
					ctx.fillStyle = grad;
					ctx.beginPath();
					ctx.moveTo(obsX, baseY);
					ctx.lineTo(obsX + w/2, baseY - h);
					ctx.lineTo(obsX + w, baseY);
					ctx.closePath();
					ctx.fill();
					// Fisuras
					ctx.strokeStyle = 'rgba(255,220,180,0.5)';
					ctx.lineWidth = 2;
					ctx.beginPath();
					ctx.moveTo(obsX + w*0.45, baseY - h*0.25);
					ctx.lineTo(obsX + w*0.55, baseY - h*0.55);
					ctx.lineTo(obsX + w*0.5, baseY - h*0.8);
					ctx.stroke();
					ctx.globalAlpha = 0.9;
					drawText('W para saltar', obsX + w/2, baseY - h - 22, 14, '#fff');
					ctx.restore();
				}
			}
		});
	}

	// Dibujar jugador
	if (cavePhase === 'exploration') {
		drawPlayer(caveCamera);
		// Dibujar cuerda de raíces si está activa
		drawVine();
	} else if (cavePhase === 'cart_cinematic') {
		// Durante la cinemática, mostrar al jugador acercándose al carrito
		drawPlayer(caveCamera);
		
		// Efectos cinemáticos
		ctx.save();
		if (cinematicPhase === 'zoom_in') {
			// Efecto de zoom con partículas
			ctx.globalAlpha = 0.1;
			ctx.fillStyle = '#ffaa00';
			for (let i = 0; i < 50; i++) {
				let angle = (i / 50) * Math.PI * 2;
				let radius = 100 + Math.sin(cinematicTimer * 5) * 50;
				let x = (cartPosition.x - caveCamera) + 30 + Math.cos(angle) * radius;
				let y = cartPosition.y + 20 + Math.sin(angle) * radius;
				ctx.beginPath();
				ctx.arc(x, y, 3, 0, Math.PI * 2);
				ctx.fill();
			}
		} else if (cinematicPhase === 'ready') {
			// Texto épico reduciendo saturación + reporte de viabilidad
			ctx.shadowColor = '#ff2e2e';
			ctx.shadowBlur = 16;
			drawText('¡PREPÁRATE!', canvas.width/2, canvas.height/2 - 60, 64, '#ff2e2e');
			drawText('Minijuego del Carrito', canvas.width/2, canvas.height/2 - 10, 30, '#ffaa00');
			if (cartFeasibilityReport) {
				let msg = cartFeasibilityReport.viable ? 'Trayecto viable' : 'Ajustando recorrido...';
				let color = cartFeasibilityReport.viable ? '#00ff88' : '#ffaa00';
				drawText(msg, canvas.width/2, canvas.height/2 + 40, 28, color);
				if (cartFeasibilityReport.adjustments) {
					drawText('Alturas adaptadas', canvas.width/2, canvas.height/2 + 80, 22, '#00ff88');
				}
			}
		} else if (cinematicPhase === 'countdown') {
			// Cuenta regresiva simplificada (menos efectos)
			let countNumber = Math.ceil(countdownTimer);
			ctx.shadowColor = '#ff2e2e';
			ctx.shadowBlur = 18;
			let countColor = countNumber <= 1 ? '#ff2e2e' : countNumber === 2 ? '#ffaa00' : '#2e8bff';
			drawText(countNumber.toString(), canvas.width/2, canvas.height/2, 96, countColor);
			// Solo una onda nueva por número
			if (lastCountdownNumber !== countNumber) {
				createCaveParticles(cartPosition.x + 30, cartPosition.y + 20, countColor, 3); // Reducido de 6 a 3
				lastCountdownNumber = countNumber;
			}
		}
		ctx.restore();
		
	} else if (cavePhase === 'cart_ride') {
		// En el carrito, mostrar al jugador dentro con efectos épicos
		let cartX = cartPosition.x - caveCamera;
		let cartY = cartPosition.y - cartJumpHeight;
		let color = '#fff';
		if (playerForm === FORMS.DESTRUCTOR) color = '#ff2e2e';
		if (playerForm === FORMS.NINJA) color = '#2e8bff';
		if (playerForm === FORMS.MAGO) color = '#ffe359';

		ctx.save();
		ctx.fillStyle = color;
		ctx.shadowColor = color;
		ctx.shadowBlur = 15 + cartSpeedMultiplier * 5;
		ctx.beginPath();
		ctx.arc(cartX+30, cartY+15, 12, 0, Math.PI*2);
		ctx.fill();
		
		// Estela de velocidad detrás del jugador
		for (let i = 1; i <= 5; i++) {
			ctx.globalAlpha = 0.3 - (i * 0.05);
			ctx.beginPath();
			ctx.arc(cartX+30 - (i * cartPosition.speed * 2), cartY+15, 12 - i, 0, Math.PI*2);
			ctx.fill();
		}
		ctx.restore();
		
		// Efectos de velocidad reducidos para evitar glitch gráfico
		if (cartPosition.speed > 5) {
			ctx.save();
			ctx.strokeStyle = '#ffaa00';
			ctx.lineWidth = 2;
			ctx.globalAlpha = 0.35;
			for (let i = 0; i < 6; i++) { // mucho menos
				let lineY = Math.random() * canvas.height;
				let lineLength = 40 + cartSpeedMultiplier * 20;
				ctx.beginPath();
				ctx.moveTo(cartX + 60, lineY);
				ctx.lineTo(cartX + 60 + lineLength, lineY);
				ctx.stroke();
			}
			ctx.restore();
			if (Math.random() < 0.12) { // Reducido de 0.25
				createCaveParticles(cartPosition.x + 60, cartPosition.y + 30, '#ffaa00', 1);
			}
		}
		
		// Efectos especiales de salto simplificados
		if (cartJumpHeight > 0) {
			if (Math.random() < 0.08) createCaveParticles(cartPosition.x + 30, cartPosition.y + 50, '#ffffff', 1); // Reducido de 0.15
		}
		
		// Dibujar enjambre de hadas persiguiendo
		batSwarm.forEach(bat => {
			let batX = bat.x - caveCamera;
			if (batX > -100 && batX < canvas.width + 100) {
				ctx.save();
				
				// Animaciones base de las hadas
				bat.wingPhase += 0.3;
				bat.glowPhase += 0.15;
				
				let baseColor = bat.color;
				let glowIntensity = bat.attackMode ? 15 : 8 + Math.sin(bat.glowPhase) * 4;
				
				// Cuerpo de hada (óvalo brillante)
				ctx.fillStyle = baseColor;
				ctx.shadowColor = baseColor;
				ctx.shadowBlur = glowIntensity;
				
				// Núcleo del hada
				ctx.beginPath();
				ctx.ellipse(batX, bat.y, bat.size * 0.8, bat.size * 0.6, 0, 0, Math.PI*2);
				ctx.fill();
				
				// Alas de hada con efecto translúcido
				ctx.globalAlpha = 0.7;
				let wingSpread = 15 * (1 + Math.sin(bat.wingPhase) * 0.5);
				
				// Ala superior izquierda
				ctx.beginPath();
				ctx.moveTo(batX, bat.y - 2);
				ctx.bezierCurveTo(
					batX - 5, bat.y - wingSpread,
					batX - 15, bat.y - wingSpread * 0.8,
					batX - 8, bat.y + 2
				);
				ctx.closePath();
				ctx.fill();
				
				// Ala superior derecha
				ctx.beginPath();
				ctx.moveTo(batX, bat.y - 2);
				ctx.bezierCurveTo(
					batX + 5, bat.y - wingSpread,
					batX + 15, bat.y - wingSpread * 0.8,
					batX + 8, bat.y + 2
				);
				ctx.closePath();
				ctx.fill();
				
				// Ala inferior izquierda
				ctx.beginPath();
				ctx.moveTo(batX, bat.y + 2);
				ctx.bezierCurveTo(
					batX - 5, bat.y + wingSpread * 0.7,
					batX - 12, bat.y + wingSpread * 0.5,
					batX - 6, bat.y + 4
				);
				ctx.closePath();
				ctx.fill();
				
				// Ala inferior derecha
				ctx.beginPath();
				ctx.moveTo(batX, bat.y + 2);
				ctx.bezierCurveTo(
					batX + 5, bat.y + wingSpread * 0.7,
					batX + 12, bat.y + wingSpread * 0.5,
					batX + 6, bat.y + 4
				);
				ctx.closePath();
				ctx.fill();
				
				// Brillo central
				ctx.globalAlpha = 0.6;
				ctx.beginPath();
				ctx.arc(batX, bat.y, bat.size * 0.4, 0, Math.PI*2);
				ctx.fill();
				
				// Estela brillante detrás
				ctx.globalAlpha = 0.3;
				for (let i = 1; i <= 3; i++) {
					ctx.beginPath();
					ctx.arc(batX - i * 3, bat.y, bat.size * 0.3 / i, 0, Math.PI*2);
					ctx.fill();
				}
				
				ctx.restore();
			}
		});
		
		// Dibujar hadas enemigas activas
		fairyEnemies.forEach(fairy => {
			if (!fairy.active) return;
			let fairyX = fairy.x - caveCamera;
			if (fairyX < -120 || fairyX > canvas.width + 120) return;
			
			ctx.save();
			// Animaciones base
			fairy.wingPhase += 0.3;
			fairy.glowPhase += 0.15;
			
			// Glow y estilo según fase
			ctx.shadowColor = fairy.color;
			let glowBoost = (fairy.phase === 'blocking') ? 25 : 15;
			ctx.shadowBlur = glowBoost + Math.sin(fairy.glowPhase) * 6;
			
			// Cuerpo principal
			ctx.fillStyle = fairy.color;
			ctx.globalAlpha = 0.95;
			ctx.beginPath();
			ctx.ellipse(fairyX, fairy.y, fairy.size * 0.55, fairy.size * 0.75, 0, 0, Math.PI*2);
			ctx.fill();
			
			// Alas de hada
			let wingSize = fairy.size * 1.2;
			let wingFlap = Math.sin(fairy.wingPhase) * 0.4;
			ctx.globalAlpha = 0.7;
			ctx.fillStyle = '#ffffff';
			
			// Ala superior izquierda
			ctx.beginPath();
			ctx.ellipse(fairyX - wingSize*0.7, fairy.y - wingSize*0.3 + wingFlap, wingSize*0.75, wingSize*1.15, -0.3, 0, Math.PI*2);
			ctx.fill();
			
			// Ala superior derecha
			ctx.beginPath();
			ctx.ellipse(fairyX + wingSize*0.7, fairy.y - wingSize*0.3 - wingFlap, wingSize*0.75, wingSize*1.15, 0.3, 0, Math.PI*2);
			ctx.fill();
			
			// Estela brillante (más larga si está en fase de movimiento)
			ctx.globalAlpha = fairy.phase === 'moving_right' ? 0.6 : 0.4;
			ctx.fillStyle = fairy.color;
			let trailLen = fairy.phase === 'moving_right' ? 6 : 3;
			let trailOffset = fairy.phase === 'moving_right' ? 8 : 3;
			
			for (let i = 1; i <= trailLen; i++) {
				ctx.beginPath();
				ctx.ellipse(fairyX - i * trailOffset, fairy.y, fairy.size * 0.4 / i, fairy.size * 0.55 / i, 0, 0, Math.PI*2);
				ctx.fill();
			}
			
			// Indicador visual según fase
			if (fairy.phase === 'blocking') {
				// Círculo de advertencia cuando está bloqueando
				ctx.globalAlpha = 0.7 + Math.sin(fairy.phaseTimer * 5) * 0.3;
				ctx.strokeStyle = '#ff1744';
				ctx.lineWidth = 3;
				ctx.beginPath();
				ctx.arc(fairyX, fairy.y, fairy.size + 12, 0, Math.PI*2);
				ctx.stroke();
			} else if (fairy.phase === 'waiting') {
				// Indicador de preparación
				ctx.globalAlpha = 0.7 + Math.sin(fairy.phaseTimer * 10) * 0.3;
				ctx.strokeStyle = '#ffaadd';
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.arc(fairyX, fairy.y, fairy.size + 8, 0, Math.PI*2);
				ctx.stroke();
			}
			
			ctx.restore();
		});
		
		// (Sistema de vías y palancas de cambio eliminado)

		// Dibujar rampas y palancas nuevas
		rampLevers.forEach(rl => {
			let leverScreenX = rl.x - 80 - caveCamera;
			let rampScreenX = rl.x - caveCamera;
			// Palanca
			if (leverScreenX > -120 && leverScreenX < canvas.width + 120) {
				ctx.save();
				ctx.fillStyle = rl.activated ? '#ffaa00' : '#555';
				ctx.shadowColor = rl.activated ? '#ffaa00' : '#222';
				ctx.shadowBlur = rl.activated ? 18 : 6;
				ctx.fillRect(leverScreenX-8, cartPosition.y - 40, 16, 40);
				ctx.strokeStyle = rl.activated ? '#ffdd55' : '#888';
				ctx.lineWidth = 4;
				let ang = rl.activated ? Math.PI/3 : -Math.PI/6;
				ctx.beginPath();
				ctx.moveTo(leverScreenX, cartPosition.y - 20);
				ctx.lineTo(leverScreenX + Math.cos(ang)*28, cartPosition.y - 20 + Math.sin(ang)*28);
				ctx.stroke();
				if (!rl.activated) {
					ctx.globalAlpha = 0.8 + Math.sin(Date.now()/200) * 0.2;
					drawText('E', leverScreenX, cartPosition.y - 54, 18, '#ffaa00');
				}
				ctx.restore();
			}
			// Rampa (si activada) con curva previa (hipérbola estilizada)
			if (rl.activated) {
				let rampW = rl.rampWidth;
				let rampH = rl.rampHeight;
				let hyperOffset = rl.hyperStartOffset || -250; // Ampliar offset para que empiece más antes
				let hyperStartScreenX = rampScreenX + hyperOffset;
				if (rampScreenX + rampW > -150 && hyperStartScreenX < canvas.width + 150) {
					ctx.save();
					// Curva previa más amplia y dramática
					ctx.strokeStyle = 'rgba(255,180,80,0.35)';
					ctx.lineWidth = 4;
					ctx.beginPath();
					for (let i = 0; i <= 60; i++) { // Más puntos para suavidad
						let t = i / 60; // 0..1
						// Hipérbola más dramática y amplia
						let localX = t * (rampW - hyperOffset);
						let rel = (localX + 1);
						// Incrementar altura y amplitud de la curva
						let heightMultiplier = 1.4; // Más pronunciada
						let curveY = cartPosition.y + 40 - (rampH * heightMultiplier * (Math.pow(rel / (rampW - hyperOffset + 2), 0.6)));
						let drawX = hyperStartScreenX + localX;
						if (i === 0) ctx.moveTo(drawX, curveY);
						else ctx.lineTo(drawX, curveY);
					}
					ctx.stroke();
					
					// Línea de trayectoria de salto más visible
					ctx.strokeStyle = 'rgba(255,220,100,0.6)';
					ctx.lineWidth = 2;
					ctx.setLineDash([8, 4]);
					ctx.stroke();
					ctx.setLineDash([]);
					
					// Cuerpo de la rampa
					ctx.fillStyle = '#7a4b12';
					ctx.shadowColor = '#ffaa00';
					ctx.shadowBlur = 12;
					ctx.beginPath();
					ctx.moveTo(rampScreenX, cartPosition.y + 40);
					ctx.lineTo(rampScreenX + rampW, cartPosition.y + 40 - rampH);
					ctx.lineTo(rampScreenX + rampW, cartPosition.y + 40);
					ctx.closePath();
					ctx.fill();
					ctx.strokeStyle = '#c27d28';
					ctx.stroke();
					ctx.restore();
				}
			}
			// Pozo y pinchos tras rampa
			let pitStart = rl.x + rl.rampWidth;
			let pitEnd = pitStart + rl.pitWidth;
			let pitScreenX = pitStart - caveCamera;
			if (pitScreenX + rl.pitWidth > -150 && pitScreenX < canvas.width + 150) {
				ctx.save();
				ctx.fillStyle = '#111';
				ctx.fillRect(pitScreenX, cartPosition.y + 40, rl.pitWidth, 140);
				// Pinchos
				for (let x = pitScreenX; x < pitScreenX + rl.pitWidth; x += 26) {
					ctx.beginPath();
					ctx.moveTo(x, cartPosition.y + 40);
					ctx.lineTo(x + 13, cartPosition.y + 8);
					ctx.lineTo(x + 26, cartPosition.y + 40);
					ctx.closePath();
					ctx.fillStyle = '#cc2222';
					ctx.fill();
				}
				// Indicador si no activada la rampa aún
				if (!rl.activated) {
					ctx.globalAlpha = 0.6;
					drawText('¡ACTIVA LA PALANCA!', pitScreenX + rl.pitWidth/2, cartPosition.y + 26, 18, '#ff4444');
				}
				ctx.restore();
			}
		});

		// Visual del vuelo (trayectoria) si activo
		if (cartFlight) {
			ctx.save();
			ctx.strokeStyle = 'rgba(255,234,120,0.4)';
			ctx.setLineDash([10,8]);
			ctx.lineWidth = 3;
			ctx.beginPath();
			let sx = cartFlight.startX - caveCamera;
			let ex = cartFlight.endX - caveCamera;
			for (let i=0;i<=20;i++) {
				let t = i/20;
				let x = sx + (ex - sx)*t;
				let y = (cartPosition.y - Math.sin(Math.PI * t) * cartFlight.maxHeight);
				if (i===0) ctx.moveTo(x, y);
				else ctx.lineTo(x, y);
			}
			ctx.stroke();
			ctx.restore();
		}
		if (cartDeathTimer > 0) {
			ctx.save();
			ctx.globalAlpha = Math.min(1, cartDeathTimer * 1.5);
			ctx.fillStyle = 'rgba(255,0,0,0.25)';
			ctx.fillRect(0,0,canvas.width,canvas.height);
			drawText('FALLO - CAISTE EN LOS PINCHOS', canvas.width/2, canvas.height/2 - 40, 42, '#ff3333');
			drawText('Reintentando...', canvas.width/2, canvas.height/2 + 10, 28, '#ffffff');
			ctx.restore();
		}

		// HUD de sentido arácnido (Druida) mejorado
		if (cavePhase === 'cart_ride' && playerForm === FORMS.DRUIDA) {
			let metros = Math.max(0, Math.floor((cartPosition.x - CART_START_X)/10));
			let next = caveObstacles.find(o => o.x > cartPosition.x);
			let distPx = next ? next.x - cartPosition.x : 0;
			let distM = next ? (distPx/10) : 0;
			let pct = next ? Math.min(100, Math.max(0, 100 - (distPx / 1200)*100)) : 100;
			ctx.save();
			ctx.globalAlpha = 0.94;
			ctx.fillStyle = 'rgba(0,0,0,0.55)';
			ctx.fillRect(canvas.width/2 - 240, 10, 480, 58);
			ctx.strokeStyle = '#2eff2e';
			ctx.lineWidth = 2;
			ctx.strokeRect(canvas.width/2 - 240, 10, 480, 58);
			ctx.font = '18px Arial Black';
			ctx.fillStyle = '#2eff2e';
			ctx.textAlign = 'left';
			ctx.fillText('Metros: '+metros, canvas.width/2 - 228, 48);
			ctx.textAlign = 'center';
			ctx.fillText('Distancia: '+ (next? distM.toFixed(1)+'m':'--'), canvas.width/2, 48);
			ctx.textAlign = 'right';
			ctx.fillText('Prox: '+ pct.toFixed(0)+'%', canvas.width/2 + 228, 48);
			// Barra proximidad compacta
			let barX = canvas.width/2 - 220;
			let barY = 20;
			let barW = 440;
			let barH = 14;
			ctx.fillStyle = '#0d250d';
			ctx.fillRect(barX, barY, barW, barH);
			let grad = ctx.createLinearGradient(barX,0,barX+barW,0);
			grad.addColorStop(0,'#2eff2e');
			grad.addColorStop(1,'#1e6bd9');
			ctx.fillStyle = grad;
			ctx.fillRect(barX, barY, barW*(pct/100), barH);
			ctx.strokeStyle = '#2eff2e';
			ctx.lineWidth = 2;
			ctx.strokeRect(barX, barY, barW, barH);
			ctx.restore();
		}
		
		// Dibujar nuevos obstáculos mejorados
		caveObstacles.forEach(obs => {
			let obsX = obs.x - caveCamera;
			if (obsX > -200 && obsX < canvas.width + 200) {
				if (obs.type === 'low_beam') {
					ctx.save();
					
					let plankW = 100;
					let baseX = obsX;
					let baseY = obs.y;
					
					// Extender madera hasta el fondo de la pantalla para que se vea apoyada
					let fullHeight = canvas.height - baseY;
					
					// Sombra en el piso para realismo
					ctx.fillStyle = 'rgba(0,0,0,0.4)';
					ctx.beginPath();
					ctx.ellipse(baseX + plankW/2, canvas.height - 3, plankW/1.5, 12, 0, 0, Math.PI * 2);
					ctx.fill();

					// Gradiente de madera realista que va hasta abajo
					let woodGrad = ctx.createLinearGradient(baseX, baseY, baseX + plankW, canvas.height);
					woodGrad.addColorStop(0, '#8B4513');
					woodGrad.addColorStop(0.15, '#A0522D'); 
					woodGrad.addColorStop(0.4, '#654321');
					woodGrad.addColorStop(0.7, '#4A2C15');
					woodGrad.addColorStop(0.9, '#3E2723');
					woodGrad.addColorStop(1, '#2A1B0F');
					
					// Dibujar madera completa hasta abajo
					ctx.fillStyle = woodGrad;
					ctx.fillRect(baseX, baseY, plankW, fullHeight);

					// Vetas de madera verticales que recorren toda la altura
					ctx.strokeStyle = 'rgba(60, 30, 15, 0.7)';
					ctx.lineWidth = 2;
					for (let i = 0; i < 4; i++) {
						ctx.beginPath();
						ctx.moveTo(baseX + 15 + i * 20, baseY + 5);
						ctx.lineTo(baseX + 10 + i * 22, canvas.height - 5);
						ctx.stroke();
					}
					
					// Líneas horizontales para textura distribuidas por toda la altura
					ctx.strokeStyle = 'rgba(120, 70, 40, 0.5)';
					ctx.lineWidth = 1;
					for (let y = 8; y < fullHeight; y += 15) {
						ctx.beginPath();
						ctx.moveTo(baseX + 3, baseY + y);
						ctx.lineTo(baseX + plankW - 3, baseY + y);
						ctx.stroke();
					}

					// Borde superior iluminado
					ctx.fillStyle = '#D2B48C';
					ctx.fillRect(baseX, baseY, plankW, 3);
					
					// Bordes laterales más oscuros para profundidad
					ctx.fillStyle = '#2E1B0F';
					ctx.fillRect(baseX, baseY, 4, obs.height);
					ctx.fillRect(baseX + plankW - 4, baseY, 4, obs.height);

					// Texto actualizado
					drawText('W: Saltar', baseX + plankW/2, baseY - 12, 14, '#fff');
					ctx.restore();
				}
				
				if (obs.type === 'breakable_rock' && !obs.broken) {
					ctx.save();
					let rockSize = obs.size === 'large' ? 60 : 40;
					
					// Roca con textura
					ctx.fillStyle = '#666';
					ctx.shadowColor = '#333';
					ctx.shadowBlur = 10;
					ctx.beginPath();
					ctx.arc(obsX + 30, obs.y + 20, rockSize/2, 0, Math.PI*2);
					ctx.fill();
					
					// Grietas en la roca
					ctx.strokeStyle = '#333';
					ctx.lineWidth = 3;
					ctx.beginPath();
					ctx.moveTo(obsX + 15, obs.y + 10);
					ctx.lineTo(obsX + 45, obs.y + 30);
					ctx.moveTo(obsX + 20, obs.y + 25);
					ctx.lineTo(obsX + 40, obs.y + 15);
					ctx.stroke();
					
					drawText('E (Destructor)', obsX + 30, obs.y - 10, 12, '#ff2e2e');
					ctx.restore();
				}
				
				if (obs.type === 'stalagmite') {
					ctx.save();
					// Estalagmita colgante
					ctx.fillStyle = '#888';
					ctx.shadowColor = '#444';
					ctx.shadowBlur = 15;
					ctx.beginPath();
					ctx.moveTo(obsX + 20, 0);
					ctx.lineTo(obsX + 40, obs.height);
					ctx.lineTo(obsX + 10, obs.height);
					ctx.closePath();
					ctx.fill();
					
					// Detalles rocosos
					ctx.fillStyle = '#666';
					for (let i = 0; i < obs.height; i += 30) {
						ctx.beginPath();
						ctx.arc(obsX + 20 + Math.sin(i/10)*5, i, 8, 0, Math.PI*2);
						ctx.fill();
					}
					
					drawText('¡Esquiva!', obsX + 20, obs.height + 20, 14, '#fff');
					ctx.restore();
				}
			}
		});
	}

	// Actualizar y dibujar partículas
	updateCaveParticles();
	drawCaveParticles();

	// UI mejorada
	drawText(`Forma: ${playerForm.toUpperCase()}`, canvas.width-40, 40, 24, '#fff', 'right');
	
	// Indicadores de habilidades activas
	let uiY = 80;
	if (player.slowTimeActive) {
		drawText('TIEMPO LENTO ACTIVO', canvas.width/2, uiY, 24, '#ffe359');
		uiY += 30;
	}
	if (player.dash) {
		drawText('DASH NINJA', canvas.width/2, uiY, 24, '#2e8bff');
		uiY += 30;
	}
	if (player.embestida) {
		drawText('EMBESTIDA ACTIVADA', canvas.width/2, uiY, 24, '#ff2e2e');
		uiY += 30;
	}
	
	// Indicadores de cooldowns ahora son globales - removidos de aquí
	
	if (cavePhase === 'cart_cinematic') {
		// UI cinemática
		if (cinematicPhase === 'zoom_in') {
			drawText('Acercándose al carrito...', canvas.width/2, canvas.height - 60, 24, '#ffaa00');
		}
	} else if (cavePhase === 'cart_ride') {
		// UI del minijuego épico

		// Velocímetro épico
		let speedText = `Velocidad: ${(cartPosition.speed * cartSpeedMultiplier).toFixed(1)}`;
		let speedColor = cartSpeedMultiplier > 2 ? '#ff2e2e' : cartSpeedMultiplier > 1.5 ? '#ffaa00' : '#00ff00';
		drawText(speedText, canvas.width - 200, 120, 18, speedColor, 'right');
		
	// Contador de hadas (enjambre)
	let activeFairies = batSwarm.filter(b => Math.sqrt((b.x - cartPosition.x)**2 + (b.y - cartPosition.y)**2) < 400).length;
	drawText(`Hadas persiguiendo: ${activeFairies}`, canvas.width - 200, 140, 16, '#ff99cc', 'right');
		
		
		// Controles dinámicos
		drawText('W: Saltar Alto | E: Destruir/Cambiar vía', canvas.width/2, canvas.height-20, 16, '#fff');
		if (cartJumpHeight === 0 && !cartJumping) {
			drawText('Mantén W para más altura', canvas.width/2, 125, 18, '#00ffcc');
		} else if (cartJumping) {
			drawText('Suelta W para caer antes', canvas.width/2, 125, 18, '#ffaa00');
		}

		
		// Avisos de peligro
		if (cartSpeedMultiplier > 2) {
			ctx.save();
			ctx.globalAlpha = 0.7 + Math.sin(time*10) * 0.3;
			drawText('¡VELOCIDAD EXTREMA!', canvas.width/2, 100, 24, '#ff2e2e');
			ctx.restore();
		}
		
		// Contador de saltos (si está saltando)
		if (cartJumpHeight > 0) {
			drawText(`Altura: ${Math.floor(cartJumpHeight)}`, canvas.width/2, canvas.height/2, 20, '#00ffff');
		}
		
	} else {
		// Ayudas contextuales en fase de exploración
		if (playerForm === FORMS.DESTRUCTOR) {
			drawText('Q: Embestida | E: Interactuar', canvas.width/2, canvas.height-20, 16, '#ff2e2e');
		} else if (playerForm === FORMS.NINJA) {
			drawText('Q: Segundo salto | E: Dash', canvas.width/2, canvas.height-20, 16, '#2e8bff');
		} else if (playerForm === FORMS.MAGO) {
			drawText('Q: Tiempo lento | E: Plataforma mágica | Mantén SPACE: Levitar', canvas.width/2, canvas.height-20, 16, '#ffe359');
		} else if (playerForm === FORMS.DRUIDA) {
			drawText('E + Mouse: Cuerda de raíces | Carrito: Sentido druida', canvas.width/2, canvas.height-20, 16, '#2eff2e');
		}
	}
	
	// Efectos de oscuridad atmosférica
	ctx.save();
	
	// Oscurecer el piso con gradiente
	let floorDarkness = ctx.createLinearGradient(0, canvas.height - 150, 0, canvas.height);
	floorDarkness.addColorStop(0, 'rgba(0,0,0,0.1)');
	floorDarkness.addColorStop(0.6, 'rgba(0,0,0,0.4)');
	floorDarkness.addColorStop(1, 'rgba(0,0,0,0.7)');
	ctx.fillStyle = floorDarkness;
	ctx.fillRect(0, canvas.height - 150, canvas.width, 150);
	
	// Bordes más oscuros para crear efecto de túnel
	let edgeDarkness = ctx.createRadialGradient(
		canvas.width/2, canvas.height/2, canvas.width*0.15,
		canvas.width/2, canvas.height/2, canvas.width*0.8
	);
	edgeDarkness.addColorStop(0, 'rgba(0,0,0,0)');
	edgeDarkness.addColorStop(0.7, 'rgba(0,0,0,0.3)');
	edgeDarkness.addColorStop(1, 'rgba(0,0,0,0.8)');
	
	ctx.globalCompositeOperation = 'multiply';
	ctx.fillStyle = edgeDarkness;
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	
	ctx.restore();
	
	// Dibujar mensajes del sentido arácnido
	// drawSpiderSenseMessages eliminado (HUD nuevo manejará info)
}
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
	
	// Controles dinámicos (como en nivel 3)
	if (playerForm === FORMS.DESTRUCTOR) {
		drawText('Q: Embestida | E: Interactuar', canvas.width/2, canvas.height-20, 16, '#ff2e2e');
	} else if (playerForm === FORMS.NINJA) {
		drawText('Q: Dash | W: Doble salto | E: Interactuar', canvas.width/2, canvas.height-20, 16, '#2e8bff');
	} else if (playerForm === FORMS.MAGO) {
		drawText('Q: Tiempo lento | E: Plataforma', canvas.width/2, canvas.height-20, 16, '#ffe359');
	} else if (playerForm === FORMS.DRUIDA) {
		drawText('E: Cuerda de raíces | Q: Impulso verde', canvas.width/2, canvas.height-20, 16, '#2eff2e');
	}
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

function resetCaveLevel() {
	// Reinicia el jugador y estado del nivel 3
	resetPlayer();
	caveCamera = 0;
	crystalActivated = false;
	cartActivated = false;
	leverPulled = false;
	cavePhase = 'exploration';
	cartPosition = { x: 1200, y: canvas.height-120, speed: 0 };
	cartChoice = null;
	cartJumping = false;
	cartJumpHeight = 0;
	cartProgress = 0;
	caveBats = [];
	caveObstacles = [];
	caveParticles = []; // Limpiar partículas
	
	// Reiniciar palancas de las rampas - NUEVO
	rampLevers.forEach(lever => {
		lever.activated = false;
		lever.flightStarted = false;
	});
	
	// Reiniciar nuevas variables del minijuego mejorado
	cinematicTimer = 0;
	cinematicPhase = 'zoom_in';
	cameraZoom = 1;
	cameraTargetZoom = 1;
	countdownTimer = 3;
	cartSpeedMultiplier = 1;
	batSwarm = [];
	fairyEnemies = [];
	railSwitches = []; /* eliminado (ya no hay vías alternas) */
	// Limpiar variables del druida
	player.rootVineCooldown = 0;
	player.vineActive = false;
	player.spiderSenseMessages = [];
	
	collectedGem = false;
	currentLevel = 2;
	state = GAME_STATE.PLAYING;
}

// === LÓGICA DEL JUEGO ===

// Función unificada de mecánicas de personajes (basada en nivel 3)
function updatePlayerCommon() {
	// Restringir druida a partir del nivel 3
	if ((currentLevel === 0 || currentLevel === 1) && playerForm === FORMS.DRUIDA) {
		playerForm = FORMS.DESTRUCTOR;
	}
	let slowFactor = player.slowTimeActive ? 0.3 : 1;
	let speed = 5 * slowFactor;
	if (playerForm === FORMS.DESTRUCTOR) {
		if (player.embestida) speed = 10;
		else if (player.embestidaFatigue > 0) speed = 2.2 * slowFactor;
	}
	if (playerForm === FORMS.NINJA) speed = 7 * slowFactor;
	
	if (isActionPressed('move_left')) player.vx = -speed;
	else if (isActionPressed('move_right')) player.vx = speed;
	else player.vx = 0;

	// Saltar
	if ((isActionPressed('jump_basic') || isActionPressed('hero_jump')) && player.onGround) {
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

	// Habilidades especiales
	if (playerForm === FORMS.NINJA && (isActionPressed('jump_basic') || isActionPressed('hero_jump')) && player.canDoubleJump && !player.onGround) {
		player.vy = -16 * slowFactor;
		player.canDoubleJump = false;
	}

	if (playerForm === FORMS.MAGO && !player.onGround) {
		if (isActionPressed('hero_jump') && player.levitateTimer < 2) {
			player.vy = Math.max(player.vy, 0 * slowFactor);
			player.levitateTimer += 1/60;
		} else {
			player.vy += 0.8 * slowFactor;
		}
	} else {
		player.levitateTimer = 0;
	}

	if (!player.onGround && playerForm !== FORMS.MAGO) player.vy += 0.6 * slowFactor;

	// === HABILIDADES ESPECIALES ===
	
	// Embestida Destructor temporizada: Q inicia 1,5s embestida, luego 3s fatiga lenta
	if (playerForm === FORMS.DESTRUCTOR) {
		// Iniciar si acción secundaria presionada y no en uso ni en fatiga
		if (isActionPressed('ability_secondary') && !player.embestida && player.embestidaTimer <= 0 && player.embestidaFatigue <= 0 && player.embestidaCooldown <= 0) {
			player.embestida = true;
			player.embestidaTimer = 1.5; // activo
			createCaveParticles(player.x + player.w/2, player.y + player.h/2, '#ff2e2e', 12);
		}
		if (player.embestida) {
			player.embestidaTimer -= 1/60;
			// Partículas rojas periódicas
			if (Math.random() < 0.25) createCaveParticles(player.x + player.w/2, player.y + player.h/2 + 10*Math.random(), '#ff4444', 2);
			if (player.embestidaTimer <= 0) {
				player.embestida = false;
				player.embestidaFatigue = 3.0; // fase lenta
				player.embestidaCooldown = 5.0; // mismo periodo bloquea reinicio
			}
		} else if (player.embestidaFatigue > 0) {
			player.embestidaFatigue -= 1/60;
			player.embestidaCooldown -= 1/60;
			if (player.embestidaFatigue < 0) player.embestidaFatigue = 0;
			if (player.embestidaCooldown < 0) player.embestidaCooldown = 0;
		} else {
			// Recuperado
			player.embestidaTimer = 0;
			player.embestidaCooldown = Math.max(0, player.embestidaCooldown - 1/60);
		}
	} else {
		player.embestida = false;
	}

	// Habilidad de movilidad del Druida (Q por defecto) - Impulso hacia dirección de la cuerda / cursor
	if (playerForm === FORMS.DRUIDA) {
		if (player.druidDashCooldown === undefined) player.druidDashCooldown = 0;
		if (player.druidDashTimer === undefined) player.druidDashTimer = 0;
		player.druidDashCooldown -= 1/60;
		if (player.druidDashCooldown < 0) player.druidDashCooldown = 0;
		if (player.druidDashTimer > 0) {
			player.druidDashTimer -= 1/60;
			// Partículas verdes durante el impulso
			if (Math.random() < 0.5) createCaveParticles(player.x + player.w/2, player.y + player.h/2, '#2eff2e', 2);
		}
		// Solo usar Q de druida si la cuerda está activa; impulsará siguiendo la dirección de la cuerda
		if (isActionPressed('ability_secondary') && player.druidDashCooldown <= 0 && player.vineActive) {
			// Calcular la dirección siguiendo el trazo de la cuerda desde el origen hasta el objetivo
			let startX = player.vineStartX || (player.x + player.w/2);
			let startY = player.vineStartY || (player.y + player.h/2);
			let targetX = player.vineTargetX;
			let targetY = player.vineTargetY;

			// Vector tangente aproximado: del origen hacia el objetivo
			let dx = targetX - startX;
			let dy = targetY - startY;
			let len = Math.hypot(dx, dy) || 1;
			dx /= len; dy /= len;

			const IMPULSE = 36; // impulso mayor para sensación poderosa
			player.vx = dx * IMPULSE;
			player.vy = dy * IMPULSE * 0.55; // reducir un poco la vertical para control
			player.onGround = false;
			player.druidDashTimer = 0.32; // control breve
			player.druidDashCooldown = 3.0; // reutilización aumentada por poder

			// Efecto visual: emitir partículas a lo largo de la cuerda
			let segments = 8;
			for (let s=0; s<segments; s++) {
				let px = startX + (dx * len) * (s/segments);
				let py = startY + (dy * len) * (s/segments);
				createCaveParticles(px, py, '#9ef4a6', 2);
			}
			// Pulso central
			createCaveParticles(player.x + player.w/2, player.y + player.h/2, '#2eff2e', 20);
		}
	}
	
	// Dash Ninja
	if (playerForm === FORMS.NINJA && keys['KeyE'] && player.dashCooldown <= 0) {
		player.dash = true;
		player.dashTimer = 0.2;
		player.dashCooldown = 1.2;
	}
	// Salto adicional Ninja con Q (una vez por salto)
	if (playerForm === FORMS.NINJA) {
		if (player.onGround) {
			player.extraNinjaJumpUsed = false;
		}
		if (!player.onGround && keys['KeyQ'] && !player.extraNinjaJumpUsed) {
			player.vy = -14; // impulso
			player.extraNinjaJumpUsed = true;
			createCaveParticles(player.x + player.w/2, player.y + player.h/2, '#2e8bff', 8);
		}
	}
	if (player.dash) {
		player.dashTimer -= 1/60;
		player.vx = player.vx > 0 ? 15 * slowFactor : -15 * slowFactor;
		if (player.dashTimer <= 0) player.dash = false;
	}
	if (player.dashCooldown > 0) player.dashCooldown -= 1/60;
	
	// Tiempo lento Mago
	if (playerForm === FORMS.MAGO && keys['KeyQ'] && player.slowTimeCooldown <= 0) {
		player.slowTimeActive = true;
		player.slowTimeCooldown = 5;
	}
	if (player.slowTimeActive && player.slowTimeCooldown > 2) {
		// Mantener activo por 3 segundos
	} else {
		player.slowTimeActive = false;
	}
	if (player.slowTimeCooldown > 0) player.slowTimeCooldown -= 1/60;

	// Cuerda de raíces Druida
	if (playerForm === FORMS.DRUIDA && keys['KeyE'] && player.rootVineCooldown <= 0) {
		let mouseX = window._mouseX || canvas.width/2;
		let mouseY = window._mouseY || canvas.height/2;
		// Ajustar por cámara (diferentes para cada nivel)
		if (currentLevel === 2) {
			player.vineTargetX = mouseX + caveCamera;
		} else if (currentLevel === 1) {
			player.vineTargetX = mouseX + cameraX;
		} else {
			player.vineTargetX = mouseX;
		}
		player.vineTargetY = mouseY;
		player.vineStartX = player.x + player.w/2;
		player.vineStartY = player.y + player.h/2;
		player.vineOriginX = player.x;
		player.vineOriginY = player.y;
		player.vineActive = true;
		player.rootVineCooldown = 1.5;
	}
	if (player.rootVineCooldown > 0) player.rootVineCooldown -= 1/60;

	// Cancelar cuerda si el druida se mueve tras lanzarla
	if (player.vineActive && playerForm === FORMS.DRUIDA && player.vineDeactivateTimer == null) {
		let dx = Math.abs(player.x - (player.vineOriginX||player.x));
		let dy = Math.abs(player.y - (player.vineOriginY||player.y));
		if (dx > 6 || dy > 10) {
			player.vineActive = false;
		}
	}

	// Actualizar persistencia de la cuerda del druida si se usó en palanca
	if (player.vineDeactivateTimer !== undefined && player.vineDeactivateTimer > 0) {
		player.vineDeactivateTimer -= 1/60;
		if (player.vineDeactivateTimer <= 0) player.vineActive = false;
	}

	player.x += player.vx;
	player.y += player.vy;

	// Plataformas mágicas (Mago)
	if (playerForm === FORMS.MAGO && keys['KeyE'] && player.platformCooldown <= 0) {
		player.platforms.push({ x: player.x, y: player.y+player.h+8, w: 80, h: 16, timer: 2 });
		player.platformCooldown = 2.6; // Aumentado de 1.5 a 2.6
	}
	if (player.platformCooldown > 0) player.platformCooldown -= 1/60;
	player.platforms.forEach(p => p.timer -= 1/60);
	player.platforms = player.platforms.filter(p => p.timer > 0);
}


function updatePlayerLab() {
	// Usar la misma lógica unificada que el nivel 3
	updatePlayerCommon();
	
	// Colisiones específicas del laboratorio
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
	// Usar la misma lógica unificada que el nivel 3
	updatePlayerCommon();
	
	// Colisiones y lógica específica del bosque
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

function updatePlayerCave() {
	if (cavePhase === 'exploration') {
		// Usar la misma lógica unificada que el resto de niveles
		updatePlayerCommon();
		
		// Cámara específica del nivel 3
		caveCamera = Math.max(0, Math.min(player.x + player.w/2 - canvas.width/2, level3Width-canvas.width));

		// Colisiones
		player.onGround = false;
		caveElements.forEach(el => {
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

			if (el.type === 'crystal') {
				// Verificar proximidad para activación automática
				let distance = Math.sqrt((player.x + player.w/2 - (el.x + el.w/2))**2 + (player.y + player.h/2 - (el.y + el.h/2))**2);
				
				if (distance < 80 && !crystalActivated) {
					crystalActivated = true;
					el.activated = true;
					// Fusionar el cristal con el jugador: cambio de estado y efectos
					player.crystalFusion = true;
					player.crystalFusionTimer = 6.0; // duración progresiva del efecto (puede ser infinito si se desea)
					
					// Hacer desaparecer el cristal del mundo
					el.visible = false;

					// Efectos de partículas de activación/fusión
					createCaveParticles(el.x + el.w/2, el.y + el.h/2, '#ff6bb9', 20);
					for (let i=0;i<24;i++) createCaveParticles(player.x + player.w/2 + Math.random()*40-20, player.y + player.h/2 + Math.random()*40-20, '#ff9bcc', 2);

					// Activar hadas ambientales en lugar de murciélagos
					initBatSwarm();
				}
			}

			if (el.type === 'lever') {
				// Calcular distancia entre el jugador y la palanca
				let playerCenterX = player.x + player.w/2;
				let playerCenterY = player.y + player.h/2;
				let leverCenterX = el.x;
				let leverCenterY = el.y + 15; // Punto medio aproximado de la palanca
				let distance = Math.sqrt((playerCenterX - leverCenterX)**2 + (playerCenterY - leverCenterY)**2);
				
				// Interacción tradicional (Destructor cerca)
				if (distance < 80 && playerForm === FORMS.DESTRUCTOR && keys['KeyE'] && !leverPulled) {
					leverPulled = true;
					el.pulled = true;
					createCaveParticles(el.x, el.y + 30, '#ff2e2e', 10);
				}
				
				// Interacción con cuerda (Druida)
				if (playerForm === FORMS.DRUIDA && player.vineActive && !leverPulled) {
					let vineDistance = Math.sqrt((player.vineTargetX - leverCenterX)**2 + (player.vineTargetY - leverCenterY)**2);
					if (vineDistance < 60) {
						leverPulled = true;
						el.pulled = true;
						createCaveParticles(el.x, el.y + 30, '#2eff2e', 15);
						// Mantener la cuerda visible un corto tiempo tras activar palanca
						player.vineDeactivateTimer = 0.8; // segundos
					}
				}
			}

			if (el.type === 'cart') {
				// Calcular distancia entre el jugador y el carrito
				let playerCenterX = player.x + player.w/2;
				let playerCenterY = player.y + player.h/2;
				let cartCenterX = el.x + 30; // Centro del carrito (60 píxeles de ancho)
				let cartCenterY = el.y + 20; // Centro del carrito (40 píxeles de alto)
				let distance = Math.sqrt((playerCenterX - cartCenterX)**2 + (playerCenterY - cartCenterY)**2);
				
				// Permitir interacción si está a menos de 80 píxeles
				if (distance < 80 && playerForm === FORMS.DESTRUCTOR && keys['KeyE'] && leverPulled && !cartActivated) {
					cartActivated = true;
					el.activated = true;
					cavePhase = 'cart_cinematic';
					cinematicTimer = 0;
					cinematicPhase = 'zoom_in';
					
					// Configurar posición inicial del carrito
					cartPosition.x = el.x;
					cartPosition.y = el.y;
					cartPosition.speed = 0;
					
					// Inicializar todos los sistemas del minijuego
					initCartObstacles();
					initBatSwarm();
					initFairyEnemies();
					initRailSwitches();
					// initRailPaths eliminado

					// Calcular viabilidad y ajustar si necesario
					cartFeasibilityReport = computeCartFeasibility();
					cartFeasibilityReport = adjustObstaclesForFeasibility(cartFeasibilityReport);
					
					// Efectos de partículas épicos para el inicio
					// Versión reducida de efectos (menos saturación)
					createCaveParticles(cartPosition.x + 30, cartPosition.y + 20, '#ffaa00', 8);
					createCaveParticles(cartPosition.x + 30, cartPosition.y + 20, '#ff6600', 5);
					let angle = Math.atan2(playerCenterY - cartCenterY, playerCenterX - cartCenterX);
					for (let i = 0; i < 6; i++) {
						let particleX = cartCenterX + Math.cos(angle) * (i * 10);
						let particleY = cartCenterY + Math.sin(angle) * (i * 10);
						createCaveParticles(particleX, particleY, '#ff2e2e', 2);
					}
				}
			}

			if (el.type === 'door' && collide(player, el) && cavePhase === 'exploration') {
				state = GAME_STATE.WIN;
			}
		});

		// Plataformas mágicas
		player.platforms.forEach(p => {
			if (collide(player, p)) {
				player.y = p.y - player.h;
				player.vy = 0;
				player.onGround = true;
			}
		});

		// Límites
		if (player.x < 0) player.x = 0;
		if (player.x + player.w > level3Width) player.x = level3Width - player.w;
		if (player.y + player.h > canvas.height) {
			player.y = canvas.height - player.h;
			player.vy = 0;
			player.onGround = true;
		}

		// Movimiento de murciélagos
		caveBats.forEach(bat => {
			if (!bat.active) return;
			
			// Movimiento básico
			bat.x += bat.vx;
			bat.y += bat.vy;
			
			// Límites
			if (bat.x < 0 || bat.x > level3Width) bat.vx *= -1;
			if (bat.y < 20 || bat.y > 200) bat.vy *= -1;
			
			// Seguir al jugador si está cerca
			let distance = Math.sqrt((bat.x - player.x)**2 + (bat.y - player.y)**2);
			if (distance < 300 && crystalActivated) {
				bat.chasing = true;
				let dx = player.x - bat.x;
				let dy = player.y - bat.y;
				bat.vx += dx * 0.002;
				bat.vy += dy * 0.002;
				// Limitar velocidad
				let maxSpeed = 3;
				if (Math.abs(bat.vx) > maxSpeed) bat.vx = Math.sign(bat.vx) * maxSpeed;
				if (Math.abs(bat.vy) > maxSpeed) bat.vy = Math.sign(bat.vy) * maxSpeed;
			}
			
			// Colisión letal con hadas usando hitbox apropiada
			if (bat.hitbox) {
				// Calcular hitbox del jugador y del hada para colisión precisa
				let playerLeft = player.x;
				let playerRight = player.x + player.w;
				let playerTop = player.y;
				let playerBottom = player.y + player.h;
				
				let batLeft = bat.x - bat.hitbox.width/2;
				let batRight = bat.x + bat.hitbox.width/2;
				let batTop = bat.y - bat.hitbox.height/2;
				let batBottom = bat.y + bat.hitbox.height/2;
				
				// Verificar colisión rectangular precisa
				if (playerRight > batLeft && playerLeft < batRight && 
					playerBottom > batTop && playerTop < batBottom) {
					// El jugador muere al tocar una hada
					player.health = 0;
					createCaveParticles(player.x + player.w/2, player.y + player.h/2, '#ff2e2e', 15);
					createCaveParticles(bat.x, bat.y, '#ff6bb9', 10);
					// Reiniciar el nivel después de un breve delay
					setTimeout(() => {
						restartLevel3();
					}, 1000);
				}
			}
		});

	} else if (cavePhase === 'cart_cinematic') {
		// Fase cinemática épica antes del minijuego
		cinematicTimer += 1/60;
		
		if (cinematicPhase === 'zoom_in') {
			// Zoom hacia el carrito
			cameraTargetZoom = 1.3; // menos abrupto
			caveCamera = Math.max(0, Math.min(cartPosition.x - canvas.width/3, level3Width-canvas.width));
			
			if (cinematicTimer > 2.2) { // más tiempo para entender
				cinematicPhase = 'ready';
				cinematicTimer = 0;
			}
		} else if (cinematicPhase === 'ready') {
			// Mostrar texto "¡Prepárate!"
			if (cinematicTimer > 1.4) { // ligero margen
				cinematicPhase = 'countdown';
				cinematicTimer = 0;
				countdownTimer = 3;
			}
		} else if (cinematicPhase === 'countdown') {
			// Cuenta regresiva 3, 2, 1
			countdownTimer -= 1/60;
			if (countdownTimer <= 0) {
				cinematicPhase = 'start';
				cinematicTimer = 0;
				cavePhase = 'cart_ride';
				cartPosition.speed = 4; // Velocidad inicial moderada
				// Activar la primera hada inmediatamente al iniciar el carrito (evitando rampas)
				if (fairyEnemies && fairyEnemies.length > 0) {
					// Evitar zonas de rampas (3250±400, 6750±500) 
					let safeX = cartPosition.x - 300;
					if (safeX > 2800 && safeX < 3700) safeX = 2700; // Antes de primera rampa
					if (safeX > 6200 && safeX < 7300) safeX = 6000; // Antes de segunda rampa
					
					fairyEnemies[0] = {
						x: safeX,
						y: 80 + Math.random()*40,
						vx: 8, // Más lenta para dar tiempo
						vy: 0,
						size: 16 + Math.random()*6,
						color: `hsl(${320 + Math.random()*40}, 80%, 72%)`,
						wingPhase: Math.random()*Math.PI*2,
						glowPhase: Math.random()*Math.PI*2,
						phase: 'moving_right',
						phaseTimer: 0,
						active: true,
						hitbox: { width: 20, height: 20 } // Hitbox razonable para fairyEnemies
					};
					createCaveParticles(fairyEnemies[0].x, fairyEnemies[0].y, fairyEnemies[0].color, 6);
				}
				cartSpeedMultiplier = 1.0; // inicia tranquilo
			}
		}
		
		// Suavizar zoom
		cameraZoom += (cameraTargetZoom - cameraZoom) * 0.05;
		
	} else if (cavePhase === 'cart_ride') {
		// Fase del carrito con rampas obligatorias
		if (!cartFlight) {
			let targetBaseSpeed = 6 * cartSpeedMultiplier;
			cartPosition.speed += (targetBaseSpeed - cartPosition.speed) * 0.04;
			cartPosition.x += cartPosition.speed;
			cartSpeedMultiplier += 0.0004;
			cartSpeedMultiplier = Math.min(cartSpeedMultiplier, 2.2);
		} else {
			// Animación de vuelo pre-calculada
			cartFlight.progress += 1/60;
			let t = Math.min(1, cartFlight.progress / cartFlight.duration);
			// Trayectoria parabólica suave
			cartPosition.x = cartFlight.startX + (cartFlight.endX - cartFlight.startX) * t;
			let arc = Math.sin(Math.PI * t) * cartFlight.maxHeight;
			cartJumpHeight = arc;
			if (t >= 1) {
				cartFlight = null;
				cartJumpHeight = 0; // aterriza
			}
		}
		if (cartDeathTimer > 0) {
			cartDeathTimer -= 1/60;
			if (cartDeathTimer <= 0) {
				// Reiniciar secuencia tras muerte
				cavePhase = 'cart_cinematic';
				cinematicPhase = 'zoom_in';
				cinematicTimer = 0;
				cartPosition.x = CART_START_X;
				cartPosition.speed = 0;
				cartJumpHeight = 0;
				cartJumping = false;
				cartSpeedMultiplier = 1;
				rampLevers.forEach(r => { r.activated = false; r.flightStarted = false; });
				cartFlight = null;
			}
		}

		// Activar rampas cuando se pulsa palanca (siempre debe activarse)
		rampLevers.forEach(rl => {
			// Palanca visual justo antes de la rampa (x - 80)
			let leverX = rl.x - 80;
			if (!rl.activated && cartPosition.x > leverX - 40 && cartPosition.x < leverX + 60) {
				// Requerir pulsar E para mantener interacción
				if (keys['KeyE']) {
					rl.activated = true;
					createCaveParticles(leverX, cartPosition.y, '#ffaa00', 10);
					createCaveParticles(leverX, cartPosition.y, '#ff2e2e', 6);
				}
			}
		});

		// Activar vuelo automático al final de la rampa
		if (!cartFlight) {
			rampLevers.forEach(rl => {
				if (rl.activated && !rl.flightStarted) {
					let rampEnd = rl.x + rl.rampWidth;
					if (cartPosition.x >= rampEnd - 5 && cartPosition.x < rampEnd + 30) {
						rl.flightStarted = true;
						let pitStart = rl.x + rl.rampWidth;
						let pitEnd = pitStart + rl.pitWidth;
						cartFlight = {
							startX: rampEnd,
							endX: pitEnd + 40,
							progress: 0,
							duration: 1.2,
							maxHeight: rl.rampHeight * 0.9
						};
						createCaveParticles(cartPosition.x, cartPosition.y, '#ffaa00', 12);
					}
				}
			});
		}

		// Muerte si entra a un pozo sin rampa activada
		if (!cartFlight) {
			for (let rl of rampLevers) {
				let pitStart = rl.x + rl.rampWidth;
				let pitEnd = pitStart + rl.pitWidth;
				if (cartPosition.x > pitStart && cartPosition.x < pitEnd && !rl.activated) {
					// Cinemática de muerte
					cartDeathTimer = 1.5;
					createCaveParticles(cartPosition.x, cartPosition.y + 60, '#ff0000', 25);
					break;
				}
			}
		}
		
		// Progreso del carrito
		cartProgress = ((cartPosition.x - 1200) / (level3Width - 1200)) * 100;
		cartProgress = Math.min(100, Math.max(0, cartProgress));

		// Cámara sigue al carrito con zoom dinámico
		caveCamera = Math.max(0, Math.min(cartPosition.x - canvas.width/2, level3Width-canvas.width));
		cameraTargetZoom = 1.1 + (cartSpeedMultiplier - 1) * 0.25; // Zoom más suave
		cameraZoom += (cameraTargetZoom - cameraZoom) * 0.03;

		// Manejo de salto del carrito (salto con mantener W para más altura)
		if (cartJumping) {
			let increment = CART_JUMP_ASCENT_RATE;
			// Bonus mientras se mantiene W y no se alcanzó el máximo
			if (keys['KeyW'] && cartJumpHeight >= CART_JUMP_MIN_HOLD_HEIGHT) {
				increment += CART_JUMP_HOLD_BONUS * (1 - (cartJumpHeight / CART_JUMP_MAX_HEIGHT));
			}
			cartJumpHeight += increment;
			if (cartJumpHeight >= CART_JUMP_MAX_HEIGHT) {
				cartJumpHeight = CART_JUMP_MAX_HEIGHT;
				cartJumping = false;
			}
			// Cancelar antes si se suelta W y ya pasó altura mínima
			if (!keys['KeyW'] && cartJumpHeight >= CART_JUMP_MIN_HOLD_HEIGHT) {
				cartJumping = false;
			}
		} else if (cartJumpHeight > 0) {
			cartJumpHeight -= CART_JUMP_DESCENT_RATE;
			if (cartJumpHeight < 0) cartJumpHeight = 0;
		}

		// Controles del carrito (buffer de salto)
		if (keys['KeyW'] && !cartJumping && cartJumpHeight === 0) {
			cartJumping = true;
			createCaveParticles(cartPosition.x + 30, cartPosition.y + 40, '#ffaa00', 2);
		}

		// (Palancas de cambio de vía eliminadas)

		// Actualizar enjambre de hadas (persecución épica)
		batSwarm.forEach((bat, index) => {
			// Animaciones base de las hadas
			bat.wingPhase += 0.3;
			bat.glowPhase += 0.15;
			
			// Comportamiento de enjambre
			let targetX = cartPosition.x - 200 - (index % 5) * 40;
			let targetY = 100 + Math.sin(Date.now()/200 + index) * 50;
			
			// Acelerar hacia el objetivo
			bat.vx += (targetX - bat.x) * 0.005;
			bat.vy += (targetY - bat.y) * 0.003;
			
			// Aumentar velocidad con el tiempo
			let speedBoost = 1 + cartSpeedMultiplier * 0.5;
			bat.vx = Math.max(-6 * speedBoost, Math.min(6 * speedBoost, bat.vx));
			bat.vy = Math.max(-4 * speedBoost, Math.min(4 * speedBoost, bat.vy));
			
			bat.x += bat.vx;
			bat.y += bat.vy;
			
			// Activación aleatoria de las hadas para atacar
			if (!bat.attacking && bat.activationTimer > 0) {
				bat.activationTimer -= 1/60;
				if (bat.activationTimer <= 0) {
					// Verificar que no haya otra hada en fases activas
					let activeAttacker = fairyEnemies.some(f => f.phase === 'moving_right' || f.phase === 'waiting' || f.phase === 'descending' || f.phase === 'blocking');
					if (activeAttacker) {
						// Reprogramar si ya hay una
						bat.activationTimer = 2 + Math.random()*3;
					} else {
						fairyEnemies.push({
							x: bat.x,
							y: bat.y,
							vx: 10,
							vy: 0,
							size: 14 + Math.random() * 6,
							color: bat.color,
							wingPhase: bat.wingPhase,
							glowPhase: bat.glowPhase,
							phase: 'moving_right',
							phaseTimer: 0,
							active: true
						});
						bat.attacking = true;
						createCaveParticles(bat.x, bat.y, bat.color, 4);
					}
				}
			}
			
			// Modo de ataque si se acercan demasiado al carrito
			let distanceToCart = Math.sqrt((bat.x - cartPosition.x)**2 + (bat.y - cartPosition.y)**2);
			if (distanceToCart < 80) {
				bat.attackMode = true;
				// Si tocan el carrito
				if (distanceToCart < 30) {
					resetCaveLevel();
					return;
				}
			}
		});

		// Actualizar hadas enemigas activas
		fairyEnemies.forEach((fairy, index) => {
			if (!fairy.active) return;
			
			// Animaciones base
			fairy.wingPhase += 0.3;
			fairy.glowPhase += 0.15;
			fairy.phaseTimer += 1/60;
			
			if (fairy.phase === 'moving_right') {
				// Se mueve rápido hacia el borde derecho de la pantalla
				fairy.x += fairy.vx;
				fairy.y += Math.sin(Date.now()/300 + index) * 0.8; // pequeña ondulación
				
				// Crear partículas de estela
				if (Math.random() < 0.3) createCaveParticles(fairy.x, fairy.y, fairy.color, 1);
				
				// Al llegar al borde derecho visible, esperar
				if (fairy.x - caveCamera > canvas.width - 100) {
					fairy.phase = 'waiting';
					fairy.phaseTimer = 0;
					fairy.targetY = canvas.height - 160; // nivel de la vía
				}
			}
			else if (fairy.phase === 'waiting') {
				// Esperar 1 segundo en el borde derecho
				fairy.y += Math.sin(Date.now()/200 + index) * 0.6;
				
				// Mantener posición relativa a la pantalla
				fairy.x = caveCamera + canvas.width - 80;
				
				// Después de 1 segundo, comenzar a descender
				if (fairy.phaseTimer >= 1) {
					fairy.phase = 'descending';
					fairy.phaseTimer = 0;
					fairy.vx = 0; // detener movimiento horizontal
					// Si hay un segundo slot de hada inactivo, activarlo ahora (sale cuando la primera comienza a bajar)
					if (fairyEnemies[1] && !fairyEnemies[1].active) {
						// Tercera hada: sale antes y más rápida, evitando zonas peligrosas
						let thirdX = cartPosition.x - 600; // Mucho más lejos
						if (thirdX > 2800 && thirdX < 3700) thirdX = 2600;
						if (thirdX > 6200 && thirdX < 7300) thirdX = 5900;
						
						fairyEnemies[1] = {
							x: thirdX,
							y: 70 + Math.random()*60,
							vx: 14, // Mucho más rápida
							vy: 0,
							size: 14 + Math.random()*6,
							color: `hsl(${300 + Math.random()*40}, 80%, 72%)`,
							wingPhase: Math.random()*Math.PI*2,
							glowPhase: Math.random()*Math.PI*2,
							phase: 'moving_right',
							phaseTimer: 0,
							active: true,
							hitbox: { width: 18, height: 18 } // Hitbox razonable para segunda hada
						};
						createCaveParticles(fairyEnemies[1].x, fairyEnemies[1].y, fairyEnemies[1].color, 6);
					}
				}
			}
			else if (fairy.phase === 'descending') {
				// Durante el descenso sigue avanzando rápido hasta tocar altura objetivo
				let dy = fairy.targetY - fairy.y;
				// Movimiento vertical controlado
				fairy.y += Math.min(4.5, Math.max(0.4, dy * 0.12));
				// Mantener avance horizontal mientras no alcanzó la altura
				fairy.x = caveCamera + canvas.width - 80 + Math.sin(Date.now()/250 + index)*6;
				// Pequeña estela mientras baja
				if (Math.random() < 0.18) createCaveParticles(fairy.x, fairy.y, fairy.color, 1);
				if (Math.abs(dy) < 6) {
					// Alinear y fijar posición final
					fairy.y = fairy.targetY;
					fairy.phase = 'blocking';
					fairy.phaseTimer = 0;
				}
			}
			else if (fairy.phase === 'blocking') {
				// Permanecer en posición bloqueando el paso
				fairy.y += Math.sin(Date.now()/300 + index) * 0.6;
				
				// Partículas de advertencia
				if (Math.random() < 0.2) createCaveParticles(fairy.x, fairy.y, fairy.color, 1);
				
				// Colisión con el carrito si no salta lo suficiente
				let distanceToCart = Math.sqrt((fairy.x - cartPosition.x)**2 + (fairy.y - cartPosition.y)**2);
				if (distanceToCart < fairy.size + 25) {
					if (cartJumpHeight < 45) {
						resetCaveLevel();
						return;
					}
				}
				// Hitbox contra el jugador (siempre que esté en el carrito)
				if (cavePhase === 'cart_ride') {
					let playerCenterX = cartPosition.x + 30;
					let playerCenterY = cartPosition.y + 20;
					
					// Usar hitbox específica si está definida
					if (fairy.hitbox) {
						// Calcular hitbox del jugador y del hada para colisión precisa
						let playerLeft = playerCenterX - player.w/2;
						let playerRight = playerCenterX + player.w/2;
						let playerTop = playerCenterY - player.h/2;
						let playerBottom = playerCenterY + player.h/2;
						
						let fairyLeft = fairy.x - fairy.hitbox.width/2;
						let fairyRight = fairy.x + fairy.hitbox.width/2;
						let fairyTop = fairy.y - fairy.hitbox.height/2;
						let fairyBottom = fairy.y + fairy.hitbox.height/2;
						
						// Verificar colisión rectangular precisa
						if (playerRight > fairyLeft && playerLeft < fairyRight && 
							playerBottom > fairyTop && playerTop < fairyBottom) {
							resetCaveLevel();
							return;
						}
					} else {
						// Usar método de distancia original como fallback
						let pdist = Math.hypot(fairy.x - playerCenterX, fairy.y - playerCenterY);
						if (pdist < fairy.size + Math.max(player.w, player.h)/2) {
							resetCaveLevel();
							return;
						}
					}
				}
				
				// Después de 3 segundos bloqueando, irse
				if (fairy.phaseTimer > 3) {
					fairy.phase = 'done';
					fairy.vx = -3;
					fairy.vy = -2;
				}
			}
			else if (fairy.phase === 'done') {
				// Alejarse diagonalmente hacia arriba-izquierda
				fairy.x += fairy.vx;
				fairy.y += fairy.vy;
				
				// Remover cuando sale de la pantalla
				if (fairy.x < caveCamera - 100 || fairy.y < -100) {
					fairy.active = false;
				}
			}
		});

		// Manejo de obstáculos mejorado
		caveObstacles.forEach(obs => {
			let distance = Math.abs(cartPosition.x - obs.x);
			
			if (obs.type === 'low_beam' && distance < 80 && cartJumpHeight < obs.height) {
				// Colisión con viga baja si no saltaste lo suficiente
				resetCaveLevel();
			}

			if (obs.type === 'breakable_rock' && !obs.broken && distance < 80) {
				if (playerForm === FORMS.DESTRUCTOR && keys['KeyE']) {
					obs.broken = true;
					// Efectos de partículas épicos de destrucción
					let particleCount = obs.size === 'large' ? 20 : 12;
					createCaveParticles(obs.x + 30, obs.y, '#8B4513', particleCount);
					createCaveParticles(obs.x + 30, obs.y, '#ffaa00', particleCount/2);
					createCaveParticles(obs.x + 30, obs.y, '#ff6600', particleCount/3);
				} else if (distance < 40) {
					// Colisión con roca no destruida
					resetCaveLevel();
				}
			}
			
			if (obs.type === 'stalagmite' && distance < 40) {
				// Esquivar estalagmitas saltando
				if (cartJumpHeight < 80) {
					resetCaveLevel();
				}
			}
		});

		// Victoria al llegar al pozo - iniciar cinematica
		if (cartPosition.x >= level3Width - 300) {
			startFinalCinematic();
		}
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

function startFinalCinematic() {
	state = GAME_STATE.CINEMATIC;
	cinematicData.active = true;
	cinematicData.phase = 'falling';
	cinematicData.timer = 0;
	cinematicData.heroY = -100; // Empieza desde arriba
	cinematicData.heroVelocity = 0;
	cinematicData.cartY = -200; // Carrito más arriba
	cinematicData.cartVelocity = 0;
	cinematicData.particles = [];
	cinematicData.cameraY = 0;
}

function updateCinematic() {
	cinematicData.timer += 1/60;
	
	if (cinematicData.phase === 'falling') {
		// Héroe y carrito cayendo con diferentes velocidades
		cinematicData.heroVelocity += 0.4; // Héroe cae un poco más lento
		cinematicData.cartVelocity += 0.5; // Carrito cae más rápido
		cinematicData.heroY += cinematicData.heroVelocity;
		cinematicData.cartY += cinematicData.cartVelocity;
		
		// Después de 3 segundos, cámara se queda estática
		if (cinematicData.timer > 3) {
			cinematicData.phase = 'suspense';
			cinematicData.timer = 0;
		}
	} else if (cinematicData.phase === 'suspense') {
		// Héroe y carrito siguen cayendo fuera de la pantalla, cámara estática
		cinematicData.heroY += cinematicData.heroVelocity;
		cinematicData.cartY += cinematicData.cartVelocity;
		
		// Después de 2 segundos de suspense
		if (cinematicData.timer > 2) {
			cinematicData.phase = 'rising';
			cinematicData.timer = 0;
			cinematicData.heroY = canvas.height + 100; // Empieza desde abajo
			cinematicData.heroVelocity = -3; // Velocidad hacia arriba
		}
	} else if (cinematicData.phase === 'rising') {
		// Crear partículas rosas desde abajo
		if (Math.random() < 0.3) {
			cinematicData.particles.push({
				x: Math.random() * canvas.width,
				y: canvas.height + 20,
				vx: (Math.random() - 0.5) * 2,
				vy: -2 - Math.random() * 3,
				size: 3 + Math.random() * 8,
				color: `hsl(${320 + Math.random() * 40}, 80%, 70%)`,
				life: 1,
				maxLife: 1
			});
		}
		
		// Actualizar partículas
		cinematicData.particles.forEach((p, index) => {
			p.x += p.vx;
			p.y += p.vy;
			p.life -= 0.015;
			if (p.life <= 0) {
				cinematicData.particles.splice(index, 1);
			}
		});
		
		// Héroe levitando hacia arriba lentamente
		cinematicData.heroY += cinematicData.heroVelocity;
		
		// Después de 4 segundos, victoria
		if (cinematicData.timer > 4) {
			state = GAME_STATE.WIN;
		}
	}
}

function drawCinematic() {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	
	if (cinematicData.phase === 'falling' || cinematicData.phase === 'suspense') {
		// Fondo oscuro de agujero profundo
		let holeGrad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 0, canvas.width/2, canvas.height/2, canvas.width);
		holeGrad.addColorStop(0, '#000');
		holeGrad.addColorStop(0.6, '#111');
		holeGrad.addColorStop(1, '#222');
		ctx.fillStyle = holeGrad;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		
		// Carrito cayendo (gris con tambaleo)
		if (cinematicData.phase === 'falling' || (cinematicData.phase === 'suspense' && cinematicData.cartY < canvas.height + 100)) {
			ctx.save();
			let wobble = Math.sin(Date.now()/120) * 6; // balanceo lateral
			ctx.translate(canvas.width/2, cinematicData.cartY + 15);
			ctx.rotate(Math.sin(Date.now()/200) * 0.08);
			ctx.translate(-canvas.width/2, - (cinematicData.cartY + 15));
			ctx.fillStyle = '#bbbbbb';
			ctx.shadowColor = '#888';
			ctx.shadowBlur = 12;
			ctx.fillRect(canvas.width/2 - 30 + wobble*0.3, cinematicData.cartY, 60, 25);
			// Ruedas
			ctx.fillStyle = '#444';
			ctx.beginPath();
			ctx.arc(canvas.width/2 - 18 + wobble*0.3, cinematicData.cartY + 25, 7, 0, Math.PI*2);
			ctx.arc(canvas.width/2 + 18 + wobble*0.3, cinematicData.cartY + 25, 7, 0, Math.PI*2);
			ctx.fill();
			ctx.restore();
		}

		// Héroe cayendo (ovalado rojo con ojos blancos, sin extremidades)
		if (cinematicData.phase === 'falling' || (cinematicData.phase === 'suspense' && cinematicData.heroY < canvas.height + 100)) {
			ctx.save();
			ctx.fillStyle = '#ff2e2e';
			ctx.shadowColor = '#ff2e2e';
			ctx.shadowBlur = 25;
			ctx.beginPath();
			ctx.ellipse(canvas.width/2, cinematicData.heroY, 24, 34, 0, 0, Math.PI*2);
			ctx.fill();
			// Ojos blancos
			ctx.fillStyle = '#ffffff';
			ctx.shadowColor = '#ffffff';
			ctx.shadowBlur = 10;
			ctx.beginPath();
			ctx.arc(canvas.width/2 - 8, cinematicData.heroY - 6, 5, 0, Math.PI*2);
			ctx.arc(canvas.width/2 + 8, cinematicData.heroY - 6, 5, 0, Math.PI*2);
			ctx.fill();
			ctx.restore();
		}
	} else if (cinematicData.phase === 'rising') {
		// Fondo mágico
		let magicGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
		magicGrad.addColorStop(0, '#1a0d2e');
		magicGrad.addColorStop(0.5, '#2e1a4a');
		magicGrad.addColorStop(1, '#4a2e6a');
		ctx.fillStyle = magicGrad;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		
		// Partículas rosas
		cinematicData.particles.forEach(p => {
			ctx.save();
			ctx.globalAlpha = p.life / p.maxLife;
			ctx.fillStyle = p.color;
			ctx.shadowColor = p.color;
			ctx.shadowBlur = 10;
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
			ctx.fill();
			ctx.restore();
		});
		
		// Héroe levitando con alas de hada (ROSA con ojos blancos)
		if (cinematicData.heroY < canvas.height - 50) {
			ctx.save();
			
			// Resplandor mágico
			ctx.shadowColor = '#ff69b4';
			ctx.shadowBlur = 30;
			
			// Alas blancas (como las de las hadas)
			let wingSpan = 60;
			let wingFlap = Math.sin(cinematicData.timer * 8) * 0.2;
			ctx.fillStyle = '#ffffff';
			ctx.globalAlpha = 0.9;
			
			// Ala izquierda
			ctx.beginPath();
			ctx.ellipse(canvas.width/2 - wingSpan*0.7, cinematicData.heroY - 20 + wingFlap, 
				wingSpan*0.8, wingSpan*1.2, -0.3, 0, Math.PI*2);
			ctx.fill();
			
			// Ala derecha
			ctx.beginPath();
			ctx.ellipse(canvas.width/2 + wingSpan*0.7, cinematicData.heroY - 20 - wingFlap, 
				wingSpan*0.8, wingSpan*1.2, 0.3, 0, Math.PI*2);
			ctx.fill();
			
			// Cuerpo del héroe (ROSA)
			ctx.globalAlpha = 1;
			ctx.fillStyle = '#ff69b4'; // Rosa brillante
			ctx.shadowBlur = 25;
			ctx.shadowColor = '#ff69b4';
			ctx.beginPath();
			ctx.ellipse(canvas.width/2, cinematicData.heroY, 25, 35, 0, 0, Math.PI*2);
			ctx.fill();
			
			// Ojos blancos brillantes
			ctx.shadowBlur = 15;
			ctx.shadowColor = '#ffffff';
			ctx.fillStyle = '#ffffff';
			ctx.beginPath();
			ctx.arc(canvas.width/2 - 8, cinematicData.heroY - 8, 5, 0, Math.PI*2);
			ctx.arc(canvas.width/2 + 8, cinematicData.heroY - 8, 5, 0, Math.PI*2);
			ctx.fill();
			
			// Aura rosa mágica
			ctx.globalAlpha = 0.6;
			ctx.fillStyle = '#ffb3da';
			ctx.shadowBlur = 35;
			ctx.shadowColor = '#ff69b4';
			ctx.beginPath();
			ctx.ellipse(canvas.width/2, cinematicData.heroY, 35, 45, 0, 0, Math.PI*2);
			ctx.fill();
			
			ctx.restore();
		}
	}
}

// === WIN SCREEN ===
function drawWin() {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	
	// Gradiente de fondo épico
	let bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
	bgGrad.addColorStop(0, '#1a0c3a');
	bgGrad.addColorStop(0.5, '#2d1b5e');
	bgGrad.addColorStop(1, '#0a0521');
	ctx.fillStyle = bgGrad;
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	
	// Dibujar jugador agrandado en el centro de la pantalla
	ctx.save();
	let playerScale = 2.5; // Escala aumentada del personaje
	let wingScale = 1.0; // Las alas mantienen su tamaño original
	let centerX = canvas.width/2;
	let centerY = canvas.height/2 - 50;
	
	// Cuerpo del jugador agrandado
	ctx.fillStyle = player.color;
	ctx.fillRect(centerX - (player.w * playerScale)/2, centerY - (player.h * playerScale)/2, 
				 player.w * playerScale, player.h * playerScale);
	
	// Dibujar alas del tamaño original
	if (playerForm === FORMS.DRUIDA) {
		// Alas druida (verdes)
		ctx.fillStyle = '#2eff2e';
		ctx.globalAlpha = 0.7;
		// Ala izquierda
		ctx.beginPath();
		ctx.ellipse(centerX - 25, centerY - 10, 20 * wingScale, 35 * wingScale, -0.3, 0, Math.PI*2);
		ctx.fill();
		// Ala derecha
		ctx.beginPath();
		ctx.ellipse(centerX + 25, centerY - 10, 20 * wingScale, 35 * wingScale, 0.3, 0, Math.PI*2);
		ctx.fill();
	} else {
		// Alas destructor (rojas)
		ctx.fillStyle = '#ff2e2e';
		ctx.globalAlpha = 0.7;
		// Ala izquierda
		ctx.beginPath();
		ctx.ellipse(centerX - 25, centerY - 10, 20 * wingScale, 35 * wingScale, -0.3, 0, Math.PI*2);
		ctx.fill();
		// Ala derecha
		ctx.beginPath();
		ctx.ellipse(centerX + 25, centerY - 10, 20 * wingScale, 35 * wingScale, 0.3, 0, Math.PI*2);
		ctx.fill();
	}
	
	// Efectos de partículas alrededor del jugador
	for(let i = 0; i < 20; i++) {
		ctx.globalAlpha = 0.6;
		ctx.fillStyle = '#ffde59';
		let angle = (Date.now() / 1000 + i) % (Math.PI * 2);
		let radius = 80 + Math.sin(Date.now() / 500 + i) * 20;
		let px = centerX + Math.cos(angle) * radius;
		let py = centerY + Math.sin(angle) * radius;
		ctx.beginPath();
		ctx.arc(px, py, 3, 0, Math.PI*2);
		ctx.fill();
	}
	
	ctx.restore();
	
	// Textos de victoria
	ctx.globalAlpha = 1;
	drawText('¡Has escapado del laboratorio!', canvas.width/2, 150, 48, '#ffde59');
	if (collectedGem) drawText('¡Encontraste la gema secreta!', canvas.width/2, 200, 32, '#ffde59');
	drawText('Presiona ENTER para volver al menú de niveles', canvas.width/2, canvas.height - 80, 28, '#fff');
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
			updatePlayerCave();
			drawLevel3();
		}
		// HUD global en niveles
		drawGlobalCooldownHUD();
	}
	else if (state === GAME_STATE.CINEMATIC) {
		updateCinematic();
		drawCinematic();
	}
	else if (state === GAME_STATE.WIN) drawWin();
	if (state !== GAME_STATE.MENU && state !== GAME_STATE.PLAYING && state !== GAME_STATE.WIN && state !== GAME_STATE.CINEMATIC) {
		// Mostrar HUD también en otras pantallas de juego si fuera necesario (placeholder)
	}
	requestAnimationFrame(gameLoop);
}
gameLoop();

// === INPUTS DE MENÚ Y NAVEGACIÓN ===
canvas.addEventListener('mousemove', function(e) {
	window._menuMouseY = e.offsetY;
	// Para el druida, guardar posición del mouse
	window._mouseX = e.offsetX;
	window._mouseY = e.offsetY;
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
					state = GAME_STATE.PLAYING;
					showTutorial = false;
					resetPlayer();
					collectedGem = false;
					// Reiniciar estado del nivel 3
					caveCamera = 0;
					crystalActivated = false;
					cartActivated = false;
					leverPulled = false;
					cavePhase = 'exploration';
					cartPosition = { x: 1200, y: canvas.height-120, speed: 0 };
					cartChoice = null;
					cartJumping = false;
					cartJumpHeight = 0;
					cartProgress = 0;
					caveBats = [];
					caveObstacles = [];
				}
			}
		});
		if (mx > 110 && mx < 330 && my > canvas.height-116 && my < canvas.height-64) state = GAME_STATE.MENU;
	} else if (state === GAME_STATE.CONTROLS) {
		// Volver
		if (mx > 110 && mx < 330 && my > canvas.height-116 && my < canvas.height-64) { state = GAME_STATE.MENU; _rebindAction=null; return; }
		// Selección de fila
		const actionLabels = [ 'move_left','move_right','jump_basic','hero_jump','form1','form2','form3','form4','ability_primary','ability_secondary' ];
		let startY=170;
		actionLabels.forEach((a,i)=>{
			let y = startY + i*48;
			if (my>y-34 && my<y+10 && mx>canvas.width/2-360 && mx<canvas.width/2+360) {
				_rebindAction = a;
			}
		});
	} else if (state === GAME_STATE.OPTIONS) {
		// Botón volver
		if (mx > 110 && mx < 330 && my > canvas.height-110 && my < canvas.height-50) {
			state = GAME_STATE.MENU;
			return;
		}
		
		// Detectar clicks en opciones de estética
		let panelX = canvas.width/2 - 400;
		let panelY = 160;
		let panelW = 800;
		let optionHeight = 80;
		let startY = panelY + 40;
		
		const aesthetics = [
			{ key: PLAYER_AESTHETICS.CLASICAS },
			{ key: PLAYER_AESTHETICS.DISTINTIVAS },
			{ key: PLAYER_AESTHETICS.PALIDAS },
			{ key: PLAYER_AESTHETICS.INVENTADA }
		];
		
		aesthetics.forEach((aesthetic, i) => {
			let optY = startY + i * optionHeight;
			if (mx > panelX + 20 && mx < panelX + panelW - 20 && 
			    my > optY && my < optY + optionHeight - 10) {
				currentAesthetic = aesthetic.key;
				saveAesthetic();
			}
		});
	}
});

window.addEventListener('keydown', function(e) {
	if (state === GAME_STATE.PLAYING && showTutorial && e.code === 'Enter') showTutorial = false;
	if (state === GAME_STATE.WIN && e.code === 'Enter') state = GAME_STATE.LEVEL_SELECT;
	// Cambiar forma
	if (state === GAME_STATE.PLAYING && !showTutorial) {
		if (keyBindings.form1.includes(e.code)) playerForm = FORMS.DESTRUCTOR;
		else if (keyBindings.form2.includes(e.code)) playerForm = FORMS.NINJA;
		else if (keyBindings.form3.includes(e.code)) playerForm = FORMS.MAGO;
		else if (keyBindings.form4.includes(e.code)) playerForm = FORMS.DRUIDA;
	}
	// Rebinding en menú controles
	if (state === GAME_STATE.CONTROLS) {
		if (e.code === 'Escape') { _rebindAction=null; }
		if (e.code === 'KeyR') { keyBindings = {...DEFAULT_KEY_BINDINGS}; saveKeyBindings(); _rebindAction=null; }
		else if (_rebindAction) {
			// Evitar asignar teclas de control críticas ESC/F11
			if (!['Escape','F11'].includes(e.code)) {
				rebindAction(_rebindAction, e.code);
				_rebindAction=null;
			}
		}
	}
});

function drawGlobalCooldownHUD() {
	let yOffset = 80;
	
	// Ninja - Dash cooldown (estilo original)
	if (player.dashCooldown > 0 && playerForm === FORMS.NINJA) {
		drawText(`Dash: ${(player.dashCooldown).toFixed(1)}s`, canvas.width-200, yOffset, 16, '#2e8bff', 'right');
		yOffset += 20;
	}
	
	// Mago - Tiempo lento cooldown (estilo original)
	if (player.slowTimeCooldown > 0 && playerForm === FORMS.MAGO) {
		drawText(`Tiempo Lento: ${(player.slowTimeCooldown).toFixed(1)}s`, canvas.width-200, yOffset, 16, '#ffe359', 'right');
		yOffset += 20;
	}
	
	// Mago - Plataforma cooldown 
	if (player.platformCooldown > 0 && playerForm === FORMS.MAGO) {
		drawText(`Plataforma: ${(player.platformCooldown).toFixed(1)}s`, canvas.width-200, yOffset, 16, '#ffe359', 'right');
		yOffset += 20;
	}
	
	// Druida - Cuerda cooldown
	if (player.rootVineCooldown > 0 && playerForm === FORMS.DRUIDA) {
		drawText(`Cuerda: ${(player.rootVineCooldown).toFixed(1)}s`, canvas.width-200, yOffset, 16, '#2eff2e', 'right');
		yOffset += 20;
	}
	// Druida - Dash verde cooldown
	if (playerForm === FORMS.DRUIDA && player.druidDashCooldown && player.druidDashCooldown > 0) {
		drawText(`Impulso: ${(player.druidDashCooldown).toFixed(1)}s`, canvas.width-200, yOffset, 16, '#2eff2e', 'right');
		yOffset += 20;
	}
	
	// Destructor - Estados de embestida
	if (playerForm === FORMS.DESTRUCTOR) {
		if (player.embestida) {
			drawText(`Embestida: ${(player.embestidaTimer).toFixed(1)}s`, canvas.width-200, yOffset, 16, '#ff2e2e', 'right');
		} else if (player.embestidaFatigue > 0) {
			drawText(`Fatiga: ${(player.embestidaFatigue).toFixed(1)}s`, canvas.width-200, yOffset, 16, '#ff6666', 'right');
		} else if (player.embestidaCooldown > 0) {
			drawText(`Recuperando: ${(player.embestidaCooldown).toFixed(1)}s`, canvas.width-200, yOffset, 16, '#ff9999', 'right');
		}
		yOffset += 20;
	}
}
