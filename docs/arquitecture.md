# Arquitectura del Juego

Este documento describe la estructura y componentes principales del juego.
## Jugabilidad General

- Juego de plataformas con una sola vida (tipo Mario): si mueres, reinicias el nivel.
- Tres formas con habilidades y pasivas únicas:
	- 🔴 Destructor: rompe muros, genera ondas de choque, embestida tras correr 2.5s (inmune y daña enemigos).
	- 🔵 Ninja: dash atraviesa zonas peligrosas, wall-jump, doble salto (segundo espacio en el aire).
	- 🟡 Mago: crea plataformas temporales (E), ralentiza el tiempo (Q), cae lentamente y camina sobre agua.
- Niveles cortos y desafiantes, con puzles y rutas alternativas.
- Checkpoints estratégicos y zonas que requieren cambiar de forma.
- Sistema de ranking por tiempo y precisión.

## Menú Principal

- Opciones: Jugar, Controles, Opciones, Salir.
- Al tocar Jugar, aparece el menú de niveles: camino visual con nodos, cada nodo es un nivel que se desbloquea al superar el anterior.

## Menú de Niveles

- Camino visual con nodos representando cada nivel.
- Solo el primer nivel está desbloqueado al inicio.
- Al completar un nivel, se desbloquea el siguiente.

## Nivel 1: El Despertar

### Contexto Narrativo
El personaje despierta en un laboratorio futurista, donde científicos lo someten a pruebas para analizar sus habilidades de transformación. Cada zona del laboratorio está diseñada para poner a prueba una forma y su poder especial.

### Estructura del Nivel
- Zona de Inicio: Tutorial visual con instrucciones de movimiento y salto.
- Prueba Destructor: Muro frágil que solo puede romperse usando la Forma Destructor (E).
- Prueba Mago: Zona de agua que solo puede cruzarse caminando como Mago.
- Prueba Ninja: Plataforma alta accesible solo con doble salto de Ninja.
- Puzle Final: Combina las tres formas para superar obstáculos.
- Coleccionable Opcional: Gema escondida para incentivar la exploración.
- Gran Puerta de Escape: Al final, el jugador debe usar el "Puño Devastador" para romper una gran puerta y escapar del laboratorio.

### Objetivo
Dominar las mecánicas básicas de cada forma y escapar del laboratorio, marcando el inicio de la aventura y la historia del personaje.
