# InnerSpace — auditoría inicial (fase 2)

Inspección de todos los archivos de `src`, entrada HTML, TypeScript, Vite, manifiesto de dependencias y configuración del sitio. No había pruebas ni base de datos. Este documento describe el estado **anterior** a las correcciones.

## Hallazgos por gravedad

| Gravedad | Hallazgo y evidencia | Consecuencia |
|---|---|---|
| Crítico | `app/store.tsx` usa únicamente `useState` para entradas, reflexiones, registros y preferencias | Toda la información desaparece al recargar/cerrar |
| Alto | Exportación JSON de sesión sin importación, validación ni archivos | No existe recuperación ni respaldo completo |
| Alto | Sin repositorios operativos, transacciones o restricciones de integridad | No hay garantías de relaciones ni operaciones atómicas |
| Alto | Sin propietario, credenciales ni protección administrativa | Administración y control de acceso inexistentes |
| Alto | Auditoría de dependencias inicial: 7 avisos altos, 7 moderados y 1 bajo (Vite y dependencias de herramientas) | Revisar versiones compatibles; algunos ataques requieren servidor de desarrollo/Windows o entradas CSS maliciosas |
| Medio | Ánimo/energía/acontecimientos incrustados en entradas, actividades identificadas por nombre | Duplicación potencial; no hay entidades independientes ni relaciones estables |
| Medio | Acontecimientos solo desde editor; recuerdos solo ejemplos/URLs | Flujos parciales, sin archivos personales |
| Medio | Botones de imagen/audio deshabilitados | Funciones únicamente visuales |
| Medio | Sin recuperación de borrador ni gestión de cuota, arranque o fallos de almacenamiento | Riesgo de pérdida de texto al navegar/fallar |
| Medio | Calendario consulta solo entradas; enlace a nueva entrada ignora fecha seleccionada | Registros breves invisibles; fecha incoherente |
| Medio | Reflexiones usan texto de pregunta como clave mutable y no conservan preguntas vacías | Edición de preguntas puede colisionar; respuestas parciales incompletas |
| Medio | Sin separación de servicios de aplicación/infraestructura; exportación en componente | Lógica de datos acoplada a la presentación |
| Medio | Fuentes Google e imágenes Unsplash remotas; sin caché offline | Arranque autónomo sin conexión no disponible |
| Medio | No hay pruebas automatizadas ni evidencia de flujos de navegador | Compilar no demuestra funcionamiento |
| Bajo | Importaciones sin uso, archivos de pocas líneas físicas con JSX muy largo | Lectura y mantenimiento difíciles |
| Bajo | Rutas importan un barril estático para todas las pantallas | Carga inicial innecesaria; investigar tamaño real después de build |
| Bajo | Marcadores de formato son texto, no editor enriquecido | Correctamente identificado en interfaz; no se debe prometer rich text |

## Clasificación funcional

- **Operativo en sesión**: rutas, navegación, creación/edición/eliminación confirmada de entradas, búsqueda textual, filtros de calendario/línea temporal/recuerdos, registro breve por fecha, reflexiones parciales con edición, claro/oscuro/automático, preferencias de lectura, exportación JSON de sesión.
- **Parcial**: calendario (solo entradas), actividades (lista fija y nombres libres), acontecimientos (solo incrustados), reflexiones (preguntas inestables), preferencias (no persisten), manejo de errores (solo campos vacíos).
- **Solo visual / pendiente**: adjuntos y audio, administración, autenticación, almacenamiento, restauración, migraciones.
- **Simulado**: tres entradas de ejemplo separadas explícitamente; galería abre en ejemplos; inicio muestra ejemplos. No deben sembrarse en la base ni contarse como datos personales.
- **Errores**: pérdida al recargar; fecha seleccionada del calendario no propagada; estadísticas y etiquetas de “sesión” no aptas para persistencia; relaciones dependientes no eliminadas/validadas por falta de infraestructura.
- **Accesibilidad**: hay etiquetas, estados aria, foco visible, diálogo nativo y movimiento reducido; falta verificación automática y de teclado/responsive.
- **Rendimiento**: todo se importa estáticamente; búsquedas lineales adecuadas para prototipo pequeño, no para grandes bibliotecas; imágenes remotas sin ciclo de vida propio.

## Decisión técnica

Dexie sobre IndexedDB es compatible con React 19, TypeScript estricto y Vite. Permite esquema versionado, índices, transacciones y observación de cambios entre pestañas sin servidor. Se elige frente a IndexedDB nativo para reducir código de coordinación y errores transaccionales. La UI consumirá servicios, nunca transacciones directamente. Binarios separados en `mediaBlobs`; ZIP versionado para respaldos completos, sin contraseñas ni sesiones exportadas. Autenticación local PBKDF2 mediante Web Crypto: barrera administrativa, **no cifrado** de IndexedDB ni protección contra quien controle el dispositivo/origen.

No existe información persistente anterior que migrar: no es posible recuperar sesiones ya cerradas. Se preservan arquitectura visual, rutas y ejemplos como demostraciones explícitas.

## Verificación requerida después de implementar

Pruebas de repositorios con IndexedDB simulado, migración real de esquema, concurrencia de inicialización, autenticación/sesiones, ZIP con binarios y rechazo atómico, pruebas E2E contra IndexedDB del navegador, recarga/contexto nuevo, navegación, temas, filtros, responsive y acceso administrativo. Registrar resultados reales y límites en el informe final.
