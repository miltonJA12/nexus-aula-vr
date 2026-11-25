
# NEXUS PHYSICS VR

## Práctica 3.2 — Interacción virtual

Laboratorio de realidad virtual desarrollado con Three.js,
WebXR y cannon-es para la clasificación de figuras geométricas
mediante simulación física y seguimiento de manos.

**Institución:** Tecnológico Nacional de México, Campus Pachuca
**Carrera:** Ingeniería en Tecnologías de la Información y Comunicaciones
**Autor:** Milton Juarez Austria
**Año:** 2026

## Objetivo

Desarrollar una experiencia de realidad virtual para Meta Quest 3
que permita clasificar veinte objetos geométricos en cuatro
recipientes mediante seguimiento de manos, gravedad, colisiones
físicas y un sistema de puntuación inmersivo.

## Características

- Cuatro mesas tridimensionales.
- Veinte figuras geométricas.
- Cinco figuras por categoría.
- Cuatro recipientes abiertos con colisionadores.
- Física con gravedad, fricción y rebote.
- Integración WebXR para realidad virtual.
- Detección del gesto de pinza.
- Cuerpos dinámicos, cinemáticos y estáticos.
- Validación de aciertos y errores.
- Puntuación y cronómetros.
- Reinicio con distribución aleatoria.
- Vista previa de escritorio.
- Publicación estática compatible con GitHub Pages.

## Categorías

| Figura           | Cantidad | Color    |
| ---------------- | -------: | -------- |
| Esfera           |        5 | Azul     |
| Cubo             |        5 | Rojo     |
| Pirámide        |        5 | Amarillo |
| Prisma hexagonal |        5 | Verde    |

Cada mesa recibe cinco figuras mezcladas.

## Tecnologías

- HTML5
- CSS3
- Bootstrap 5.3.3
- JavaScript ES Modules
- Three.js 0.170.0
- cannon-es 0.20.0
- WebXR
- GitHub Pages

No se requiere Node.js, npm, backend ni base de datos.

## Física

Three.js representa visualmente las figuras.

cannon-es realiza la simulación de cuerpos rígidos mediante
gravedad, masa, fricción, restitución y colisiones.

Los cuerpos se clasifican como:

- Dinámicos: figuras sometidas a gravedad.
- Estáticos: suelo, mesas y recipientes.
- Cinemáticos: figuras manipuladas temporalmente con las manos.

La simulación utiliza un paso fijo de 1/60 segundos.

Las esferas usan colisionadores esféricos; los cubos usan
cajas; las pirámides y los prismas utilizan aproximaciones
convexas.

## Reglas

1. Presionar Comenzar para iniciar el cronómetro.
2. Tomar una figura y depositarla en un recipiente.
3. Esperar a que se estabilice físicamente.
4. Un depósito correcto incrementa la puntuación.
5. Un depósito equivocado registra un error.
6. Las figuras incorrectas pueden regresar a una mesa.
7. La actividad finaliza al alcanzar veinte aciertos.

Precisión:

Precisión = aciertos / intentos confirmados × 100

Los tiempos por categoría se calculan desde el inicio de la
partida hasta la validación de la quinta pieza correspondiente.

## Ejecutar en computadora

1. Abrir el proyecto en Visual Studio Code.
2. Ejecutar index.html con Live Server.
3. Abrir la sección Laboratorio interactivo.
4. Verificar escena, gravedad y recipientes.
5. Presionar Comenzar clasificación.
6. Utilizar las herramientas de diagnóstico en Console.

La vista de escritorio NO sustituye la experiencia inmersiva.

## Probar en Meta Quest 3

1. Publicar el proyecto en GitHub Pages HTTPS.
2. Abrir la URL desde Meta Quest Browser.
3. Verificar soporte immersive-vr.
4. Permitir seguimiento de manos.
5. Ingresar a la sesión inmersiva.
6. Probar detección de ambas manos y gesto de pinza.
7. Comprobar agarre, desplazamiento y liberación física.
8. Registrar pruebas, errores y rendimiento.

## Estado de validación

La interfaz web, la escena y una prueba de depósito físico
han sido comprobadas en computadora durante el desarrollo.

El seguimiento real de manos, la clasificación completa de
veinte figuras y el rendimiento en Meta Quest 3 permanecen
NO PROBADOS en esta versión.

También quedan pendientes pruebas exhaustivas de contacto
contra paredes, penetraciones por movimiento cinemático,
accesibilidad espacial y estabilidad tras múltiples reinicios.

## Evolución de la práctica 3.1

Este proyecto se desarrolló en una carpeta independiente,
tomando como referencia las funciones de interacción y
seguimiento de manos de la práctica 3.1.

La práctica 3.2 agrega cuerpos rígidos, gravedad, colisiones
y clasificación geométrica.

## Referencias

- https://threejs.org/
- https://threejs.org/docs/
- https://pmndrs.github.io/cannon-es/
- https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API

## Licencias

Three.js y cannon-es se distribuyen bajo licencia MIT.
Las figuras y los elementos geométricos del laboratorio
se generan mediante código.
