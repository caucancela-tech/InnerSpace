# InnerSpace — informe de implementación y verificación de la fase 2

## Resultado

Se ha evolucionado el proyecto React + Vite existente, sin reconstruirlo ni conectar Payload, Supabase, Firebase, una API, un servidor de aplicación o IA. Se conservan la identidad marfil/salvia, tipografía editorial, navegación y funcionalidades personales. Ahora la fuente de datos es IndexedDB mediante Dexie, no el estado temporal de React.

Documentación complementaria:

- [Auditoría anterior a las modificaciones](./AUDITORIA-INICIAL.md): clasificación crítica/alta/media/baja y estado funcional inicial.
- [Arquitectura, esquema, relaciones, formato de respaldo y seguridad](./ARQUITECTURA-LOCAL.md).

## Estado inicial y correcciones

| Estado encontrado | Corrección aplicada |
|---|---|
| Pérdida total de registros y preferencias al cerrar/recargar | Base `InnerSpace`, esquema versionado, servicios transaccionales y lectura reactiva persistida |
| Ánimo, energía y acontecimientos incrustados; actividades por nombre | Tablas independientes, ámbitos únicos, IDs estables y referencias comprobadas |
| Sin archivos personales | Metadatos y binarios independientes, validación, vistas previas y eliminación controlada |
| Acontecimientos dependientes del diario | Creación/edición independiente; eliminar una entrada conserva los acontecimientos y archivos con las referencias ajustadas |
| Calendario limitado a entradas | Entradas, registros breves y acontecimientos reales; filtros y enlace al editor con fecha seleccionada |
| Sin recuperación de páginas incompletas | Guardado explícito de borrador, reapertura y protección de navegación/recarga del editor |
| Preguntas de reflexión con claves mutables | Identidad por posición durante edición; validación de preguntas, conservación de respuestas vacías y carga de periodos anteriores |
| Preferencias concurrentes podían sobrescribirse | Servicio de actualizaciones parciales transaccionales; estado global contempla escrituras simultáneas |
| Sin propietario ni administración | Inicialización atómica de propietario único, acceso local y panel con estadísticas/diagnóstico reales |
| JSON temporal sin restauración | ZIP completo versionado, binarios, SHA-256, validación previa y reemplazo atómico confirmado |
| Posible bloqueo de descarga si la cuota impide registrar el respaldo | La copia válida sigue descargándose, con advertencia sobre la fecha no registrada |
| Posible error falso tras restauración confirmada si falla auditoría de cierre | Se distingue el commit de restauración de la auditoría posterior de logout |
| Fuentes y fotografías remotas; sin arranque offline | Fuentes/fotografías originales locales y caché de producción, incluyendo rutas diferidas |
| Sin pruebas | Pruebas de servicios, integración con IndexedDB, migración nativa y flujos completos de navegador |
| Contraste insuficiente de textos secundarios | Ajuste de color conservando la paleta; pruebas axe en Configuración y Administración |
| Carrera entre guardado y publicación reactiva al abrir entrada recién creada | Montaje condicionado a disponibilidad; se conserva el formulario frente a cambios posteriores |
| Bundle con React de desarrollo por `NODE_ENV` heredado | Build de producción efectivo, páginas diferidas y chunks de dependencias; sin advertencia de >500 kB |

No había una base persistente anterior que migrar desde el prototipo. Las sesiones ya cerradas no son recuperables; no se han inventado datos para sustituirlas.

## Funcionalidades realmente disponibles

- **Diario:** crear, abrir, editar, guardar borrador y eliminar con confirmación. Validación, fechas y relaciones; el texto se mantiene ante errores. Se detecta una versión de entrada obsoleta para no sobrescribir cambios de otra vista.
- **Ánimo y energía:** registro/actualización por fecha o vinculado a una entrada, históricos, escalas validadas y ámbitos únicos sin duplicados al editar.
- **Actividades:** catálogo personal con categoría, edición por ID, eliminación de asociaciones e historial de fechas.
- **Calendario:** meses, días con datos persistidos, filtros, lista/cuadrícula, detalle y navegación a la entrada/registro/línea temporal.
- **Línea temporal:** acontecimientos independientes o vinculados, edición, eliminación y filtros por periodo/etiqueta.
- **Reflexiones:** revisiones independientes, guardado parcial, personalización de preguntas y edición de periodos pasados.
- **Recuerdos:** fotografías y archivos de audio reales, referencias a entradas/acontecimientos, búsqueda/filtros y borrado de referencias/binario conjunto.
- **Búsqueda:** contenido persistido, normalización de acentos, fechas y etiquetas. No es búsqueda semántica.
- **Preferencias:** claro, oscuro, automático, texto ampliado y movimiento reducido; persistencia real.
- **Administración:** estadísticas, esquema, migraciones, integridad, estimaciones disponibles del origen, tamaños reales de archivos, limpieza de archivos sin referencias confirmada, solicitud de almacenamiento duradero, contraseña, bloqueo, sesiones y eventos administrativos.
- **Respaldos:** ZIP completo, validación, confirmación explícita, importación y restauración atómica; se conservan las credenciales del propietario del dispositivo receptor.
- **Offline:** arranque y edición de producción después de la primera carga/caché, verificados tras cerrar y reabrir un navegador con el mismo perfil.

Los ejemplos se mantienen separados y de solo lectura. No se insertan en IndexedDB ni se cuentan como información personal. Los catálogos personales empiezan vacíos.

## Arquitectura y base de datos

Presentación en `features/` y `components/`; dominio y validación en `domain/`; casos de uso por capacidad en `application/`; base y repositorios en `infrastructure/`; coordinación reactiva en `app/`.

Módulos operativos para journal, mood, energy, activities, calendar, timeline, reflections, memories/media, search, preferences, administration, backup y privacy. No hay carpetas vacías ni acceso directo de los componentes a IndexedDB.

Tablas:

```
journalEntries, moodRecords, energyRecords, activities, activityRecords,
lifeEvents, reflections, tags, dailyRecords, mediaAssets, mediaBlobs,
users, preferences, appSettings, databaseMetadata, backupMetadata,
migrations, auditEvents
```

Versión Dexie **2**; migración no destructiva desde v1. IndexedDB no implementa claves foráneas declarativas: los servicios verifican las relaciones dentro de transacciones. Véase el documento de arquitectura para índices y políticas de eliminación.

## Pruebas ejecutadas y alcance

### Comandos

```sh
pnpm format src tests
pnpm typecheck
pnpm test
pnpm build
TEST_BASE_URL=http://localhost:3000 pnpm test:e2e
TEST_BASE_URL=http://localhost:3000 pnpm test:e2e --grep 'exportación e importación|producción inicia'
pnpm audit --prod
pnpm audit --json
git diff --check
```

El servidor supervisado existente estaba en el puerto 3000. No se inició otro servidor de desarrollo. La prueba offline sirve únicamente el artefacto estático `dist` mediante un servidor temporal dentro del test. En otro entorno, ajustar `TEST_BASE_URL` y `CHROMIUM_PATH` si es necesario.

### Resultados

- **TypeScript:** correcto para aplicación y configuración Vite, con el proyecto estricto existente.
- **Vitest: 18/18 pruebas**, usando `fake-indexeddb`, no un mock de los repositorios:
  - CRUD y reapertura de conexión.
  - Consultas indexadas por fecha/etiqueta, búsquedas y calendario.
  - Borradores, fechas imposibles y relaciones inexistentes.
  - Ánimo, energía, actividades, archivos y eliminación coherente.
  - Conflicto de versión de entrada y actualización concurrente de preferencias.
  - Acontecimientos/reflexiones independientes.
  - Migración v1→v2.
  - Inicialización de propietario desde dos conexiones concurrentes.
  - Derivación de credenciales, acceso incorrecto, bloqueo, expiración, cambio de contraseña y cierre.
  - ZIP con binarios, restauración confirmada, archivo corrupto/incompleto o incompatible e integridad.
  - Rollback de restauración ante un fallo de cuota inyectado durante la escritura.
  - Exportación de rescate aunque falle el registro de metadatos por cuota.
  - Restauración correctamente informada aunque falle la auditoría posterior del logout.
- **Playwright Chromium: 7/7 flujos completos**:
  1. Diario → IndexedDB real → recarga → calendario → línea temporal → recuerdos → búsqueda → edición → eliminación.
  2. Registro breve, reflexión parcial, borrador, temas persistentes, respuesta automática al tema del sistema, reducción de movimiento, responsive y axe.
  3. Acceso administrativo, descarga ZIP, importación desde la interfaz y restauración de registros/imagen.
  4. CRUD de actividades y acontecimientos independientes, presencia en calendario, expiración, cambio de contraseña y bloqueo de otra pestaña.
  5. Base v1 creada con IndexedDB nativo, migración a v2 y conservación de entrada/imagen.
  6. Archivo inválido y `QuotaExceededError` inyectado en IndexedDB del navegador: sin falso guardado, texto conservado y reintento exitoso.
  7. Build de producción, cierre y reapertura de navegador con perfil persistente, sin internet, lectura/edición/recarga y administración bloqueada tras reiniciar.
- Tras la comprobación preventiva final de tamaños de respaldo, se repitieron TypeScript, las 18 pruebas de servicios, la compilación y los 2 flujos de navegador afectados (respaldo/restauración y producción offline): todos correctos.
- **Accesibilidad:** cero incidencias axe WCAG A/AA en las pantallas escaneadas de Configuración y Administración. No es una certificación WCAG completa ni una prueba de lector de pantalla en todas las páginas.
- **Revisión visual:** capturas de móvil y administración de escritorio inspeccionadas; se conserva la identidad editorial. El flujo de producción también genera captura offline.
- **Build:** correcto, con service worker y caché de rutas/fuentes/imágenes. Chunk mayor aproximadamente **190 kB minificados** (React); principal de aplicación aproximadamente **49 kB**. No aparece la advertencia de chunks >500 kB.
- **Dependencias de producción:** `pnpm audit --prod` sin vulnerabilidades conocidas.
- **Auditoría total:** no está completamente limpia: **3 avisos moderados y 1 bajo**, en dependencias de herramientas de build de Workbox (`glob`, dos versiones de `minimatch`, `deepmerge`). Sin avisos altos o críticos tras actualizar Vite y corregir `source-map-js`. La auditoría total devuelve salida no cero por esos avisos; no se presenta como aprobada.
- **Formato:** oxfmt ejecutado correctamente con valores predeterminados; avisa de que no existe configuración personalizada.
- No se ha calculado un porcentaje de cobertura ni realizado una prueba de carga masiva.

Las credenciales de pruebas solo están en fixtures de test y no se distribuyen en la aplicación.

## Archivos creados

```
docs/AUDITORIA-INICIAL.md
docs/ARQUITECTURA-LOCAL.md
docs/INFORME-FASE2.md
src/domain/validation.ts
src/domain/integrations.ts
src/infrastructure/database.ts
src/infrastructure/repositories.ts
src/application/activities.ts
src/application/administration.ts
src/application/auth.ts
src/application/backup.ts
src/application/calendar.ts
src/application/checkins.ts
src/application/energy.ts
src/application/errors.ts
src/application/integrity.ts
src/application/journal.ts
src/application/media.ts
src/application/mood.ts
src/application/preferences.ts
src/application/privacy.ts
src/application/reflections.ts
src/application/search.ts
src/application/snapshot.ts
src/application/timeline.ts
src/components/MediaPreview.tsx
src/features/activities/ActivityManager.tsx
src/features/administration/Administration.tsx
src/features/administration/BackupPanel.tsx
src/features/administration/SecurityPanel.tsx
src/features/administration/Setup.tsx
src/features/checkin/Checkin.tsx
src/features/memories/LocalMemories.tsx
src/features/preferences/Preferences.tsx
src/features/reflections/Reflections.tsx
src/features/timeline/Timeline.tsx
public/images/landscape.jpg
public/images/forest.jpg
public/images/sea.jpg
tests/setup.ts
tests/local.test.ts
tests/e2e/app.spec.ts
tests/e2e/offline.spec.ts
vitest.config.ts
playwright.config.ts
```

## Archivos modificados

```
.figma/make/site.json          (título, idioma y descripción; no scripts de despliegue)
.gitignore                    (resultados locales de pruebas)
package.json, pnpm-lock.yaml   (dependencias, checks y parche de herramienta)
vite.config.ts                (producción efectiva, división de código, caché offline)
src/app/routes.tsx            (carga diferida, administración, estado de almacenamiento)
src/app/store.tsx             (sustitución justificada del estado temporal por coordinación local)
src/components/ui.tsx         (actividades reales, medios, diálogos accesibles)
src/domain/models.ts          (modelos de lectura, tipos canónicos y assets locales)
src/features/explore.tsx      (calendario real, archivo de recuerdos y ejemplos separados)
src/features/home.tsx         (resumen derivado de datos reales y mensajes locales)
src/features/journal.tsx      (guardado asíncrono, borradores, archivos, errores y conflictos)
src/features/personal.tsx     (separación por capacidad, compatibilidad de exportaciones)
src/features/pages.ts         (exportaciones/formato)
src/index.css                 (fuentes locales, administración, responsive y contraste)
src/App.tsx, src/main.tsx      (formato; se conserva montaje React)
```

## Límites y pendientes explícitos

1. **No hay cifrado de la base ni del ZIP.** El acceso administrativo no protege el diario frente a quien controle el dispositivo, el perfil, extensiones o scripts del mismo origen.
2. El navegador puede eliminar información por borrado del sitio, pérdida de perfil, modo privado o políticas de almacenamiento. `persist()` no garantiza conservación. Se necesitan respaldos externos.
3. El uso offline está implementado en **producción**, después de la primera instalación en HTTPS/localhost y para el mismo origen. Vite de desarrollo no instala service worker.
4. La cuota se ha probado mediante errores inyectados; no llenando físicamente todo el almacenamiento del dispositivo.
5. Los borradores de diario son de guardado explícito. No hay autoguardado continuo de cada pulsación, grabador de micrófono integrado ni recuperación remota de contraseña.
6. Se adjuntan archivos de audio y se conservan en respaldos; no se ha probado la reproducción de todos los códecs en todos los navegadores.
7. El respaldo admite hasta 25 MB por archivo, 10 000 archivos, 100 000 filas por tabla, 50 MB de manifiesto, 200 MB de ZIP y 500 MB expandidos. No hay respaldo en streaming para bibliotecas de varios GB.
8. Las búsquedas son textuales y locales; el conjunto de textos/metadatos se mantiene en memoria para las vistas. Falta medir y optimizar bibliotecas grandes mediante paginación e indexación incremental.
9. Se ha probado Chromium. Safari/WebKit, Firefox, dispositivos físicos, tecnologías asistivas y escenarios de suspensión/expulsión del navegador requieren una matriz adicional.
10. El diario incorpora detección de versiones obsoletas; no existe un motor general de resolución/mezcla de conflictos para edición simultánea de todas las entidades.
11. Los avisos de herramientas de build pendientes deben seguirse en actualizaciones compatibles de Workbox. No se han forzado cambios mayores de sus dependencias internas.
12. Otros idiomas, formatos de fecha, sincronización, API, IA y búsqueda semántica están desactivados/no implementados. Solo se preparan contratos independientes con consentimiento.
13. El antiguo JSON temporal no se importa como respaldo completo; carece del formato y los binarios necesarios. Una futura importación asistida de ese formato deberá identificarlo como recuperación parcial.

## Siguiente fase recomendada

Antes de conectar IA o sincronización: ampliar QA multidispositivo/navegador, probar tamaños grandes y suspensión real, diseñar cifrado con recuperación de claves, respaldos en streaming y resolución explícita de conflictos. Las integraciones futuras deben seguir siendo opcionales, con autorización por propósito/entradas y sin modificar automáticamente los originales.

## Uso inmediato

Abre la aplicación y crea al propietario local con una contraseña de al menos 12 caracteres. Guarda una entrada o borrador, recarga y vuelve a abrirlo. Desde **Administración** —también accesible en Configuración móvil— desbloquea el panel y descarga un respaldo completo. Comprueba la descarga y consérvala fuera del navegador antes de cualquier restauración o mantenimiento destructivo.
