# InnerSpace — arquitectura local-first

## Límites y flujo de datos

```
Pantallas / componentes React
  → servicios de aplicación por capacidad
  → repositorios validados / transacciones Dexie
  → IndexedDB «InnerSpace»
  → readSnapshot + liveQuery (también entre pestañas)
  → contexto React de lectura → todas las vistas
```

`useState` se reserva para formularios, cambios aún no guardados y estado de interfaz. No es la fuente de datos personales. No hay Payload, servidor de aplicación, proveedor remoto, sincronización, telemetría ni IA. Las únicas conexiones de la aplicación son las necesarias para cargar sus propios archivos en el mismo origen; el build los conserva para uso offline.

### Responsabilidades

- `domain/validation.ts`: esquemas Zod estrictos y tipos de filas persistidas. Fechas civiles reales, límites de longitud, escalas, referencias únicas y campos permitidos.
- `domain/models.ts`: modelos de lectura/editor y ejemplos explícitos; los binarios no forman parte del diario.
- `domain/integrations.ts`: contratos futuros de sincronización opcional, importación de dispositivo, búsqueda semántica y descripciones con consentimiento. Ningún adaptador está conectado.
- `infrastructure/database.ts`: única definición de base, índices, versiones y migraciones.
- `infrastructure/repositories.ts`: consultas por ID/fecha/etiqueta y guardado con validación.
- `application/journal.ts`: escritura atómica de entrada, ánimo, energía, asociaciones, etiquetas, acontecimiento destacado y archivos nuevos; control optimista de versiones para el editor.
- `application/checkins.ts`: un registro breve por fecha, con ámbitos separados de los registros del diario.
- `application/mood.ts`, `energy.ts`: módulos independientes de registro e históricos por fecha; sustitución idempotente, validación de origen y participación en las transacciones de diario/registro breve.
- `application/preferences.ts`: actualización transaccional de opciones parciales; cambios concurrentes de tema y accesibilidad no se sobrescriben.
- `application/activities.ts`: catálogo personal, categorías e historial; renombrar conserva ID, eliminar desvincula.
- `application/calendar.ts`, `search.ts`, `snapshot.ts`: selecciones coherentes y unión de datos; mapas evitan uniones cuadráticas en la lectura reactiva.
- `application/timeline.ts`, `reflections.ts`: entidades independientes, editables, sin necesidad de entrada original.
- `application/media.ts`: validación de firma/tipo/tamaño, almacenamiento binario y eliminación controlada de referencias. `MediaPreview` revoca las object URLs al desmontarse.
- `application/auth.ts`, `administration.ts`, `integrity.ts`: propietario, acceso temporal, diagnóstico no destructivo, mantenimiento confirmado y auditoría sin contenido personal.
- `application/backup.ts`: ZIP completo, validación previa y reemplazo transaccional.
- `application/privacy.ts`: política transparente y preferencias iniciales sin datos personales ficticios.
- `app/store.tsx`: coordina lectura reactiva y estados de las escrituras. Solo confirma después de resolver la transacción.
- `features/`: interfaz existente conservada; se separaron registro breve, reflexiones, preferencias, acontecimientos y administración por responsabilidad.

La UI no abre IndexedDB ni escribe tablas directamente. Los servicios de operaciones multientidad son los dueños de sus transacciones; no se añaden carpetas vacías ni un repositorio genérico que permita editar el sistema desde un formulario arbitrario.

## Esquema

Esquema Dexie **2** (versión nativa IndexedDB 20). V1 crea las tablas; V2 añade índice `updatedAt` de archivos y completa su fecha de modificación sin borrar datos.

| Tabla | Clave e índices / relación |
|---|---|
| journalEntries | `id`; `entryDate`, `updatedAt`, `status`, `*tags`; referencias a IDs de actividades y archivos |
| moodRecords | `id`; único `scopeKey`; `recordedAt`, `entryReference` opcional |
| energyRecords | Igual; energía entera 1–5 y definición fija de escala |
| activities | `id`; nombre único; categoría |
| activityRecords | `id`; `scopeKey`, `activityId`, fecha y entrada opcional; pareja ámbito/actividad única |
| lifeEvents | `id`; fecha, etiquetas, entrada opcional y referencias a medios |
| reflections | `id`; inicio y fin de periodo; respuestas parciales, preguntas vacías de respuesta incluidas |
| tags | `id` igual al nombre inmutable; nombre único. Se conserva el catálogo aunque deje de usarse |
| dailyRecords | fecha como clave; fecha única, contexto |
| mediaAssets | `id`; tipo, creación y modificación; MIME, nombre y tamaño |
| mediaBlobs | el mismo `id`; `Blob` o `File`, sin Base64 |
| users | clave fija `root`; un único propietario local, credencial derivada y límite de intentos |
| preferences | clave fija `owner`; tema, lectura, idioma y conexiones externas desactivadas |
| appSettings | clave fija `system`; inactividad y solicitud de almacenamiento duradero |
| databaseMetadata | versión de esquema e inicialización |
| migrations | historial de versiones aplicadas |
| backupMetadata | generación/restauración de respaldos, fecha y tamaño cuando procede |
| auditEvents | acción administrativa, ID y fecha; sin texto del diario ni contraseñas |

### Relaciones y eliminación

- Ámbito `entry-{id}` para registros ligados a entradas y `day-{fecha}` para registros breves: no se duplican al editar ni se mezclan.
- Una entrada tiene cero o un registro de ánimo y energía en su ámbito; asociaciones de actividad independientes y únicas.
- Un acontecimiento destacado desde el editor tiene ID `event-{entryId}`. Otros acontecimientos no dependen de una entrada.
- **Eliminar entrada** elimina sus registros de ánimo, energía y actividad; conserva acontecimientos y binarios como recuerdos independientes y retira la referencia a la entrada.
- **Desvincular archivo en editor** no elimina el binario. **Eliminar archivo en Recuerdos** retira todas sus referencias y borra metadatos/binario en una sola transacción.
- **Eliminar actividad** retira las asociaciones y las referencias de las entradas; no borra entradas.
- Un archivo sin referencias no es necesariamente corrupción: puede ser un recuerdo conservado. Solo se elimina tras confirmación.
- La base tiene índices y restricciones de unicidad; la integridad referencial se comprueba en los servicios y transacciones, porque IndexedDB no ofrece claves foráneas declarativas.

## Respaldos y recuperación

ZIP de formato `innerspace-complete`, versión de formato **1**, esquema **2**:

- `manifest.json`: fecha, tablas personales, preferencias/configuración y lista de archivos.
- `media/{id}`: todos los binarios, incluso los archivos independientes sin referencias.
- Identificador, tamaño, MIME y SHA-256 de cada archivo. SHA-256 detecta alteraciones; **no es firma de autenticidad ni cifrado**.
- Excluye contraseña, sesión y auditoría local. La restauración conserva al propietario y el historial del dispositivo.
- Valida esquema, versión, IDs duplicados, ámbitos, fechas, asociaciones, referencias, firmas de archivo, tamaño y hash antes de habilitar la restauración.
- El reemplazo exige aviso, aceptación y palabra `RESTAURAR`. Se ofrece descargar primero la información actual.
- Todas las eliminaciones/escrituras de la restauración comparten una transacción: errores de cuota, restricciones o escrituras abortan todo.
- Un fallo no modifica la base anterior. Se puede reintentar después de liberar espacio, usar un respaldo anterior o importar el ZIP original en otro perfil con versión compatible.
- La fecha de “último respaldo” indica **generación**, no prueba que el usuario haya conservado la descarga.
- Si no queda cuota para registrar esa fecha, la descarga sigue disponible y muestra una advertencia. Un fallo de auditoría posterior al cierre de sesión no convierte una restauración ya confirmada en un supuesto fallo con rollback.

Límites explícitos: 25 MB por archivo, 10 000 archivos, 100 000 filas por tabla de respaldo, manifiesto hasta 50 MB, ZIP hasta 200 MB y total expandido hasta 500 MB. La suma de tamaños se comprueba antes de cargar los binarios en memoria. El procesamiento usa memoria y descompresión local acotada; no se ha diseñado para bibliotecas de varios GB. No se acepta el antiguo JSON de sesión como si fuera un respaldo completo.

## Seguridad y almacenamiento

- PBKDF2-HMAC-SHA-256, 600 000 iteraciones, sal aleatoria de 128 bits y derivación de 256 bits mediante Web Crypto. No hay contraseña predeterminada ni texto plano.
- Inicialización atómica de `root`, preferencias, configuración y metadatos; dos pestañas no pueden crear propietarios distintos.
- Sesión administrativa solo en memoria, máximo 8 horas, bloqueo 1–60 minutos, cierre explícito y pérdida al recargar. Cambio de contraseña cierra sesión y notifica la revocación a otras pestañas cuando BroadcastChannel está disponible.
- Cinco intentos incorrectos bloquean durante un minuto. Esto no pretende resistir a alguien con control del navegador.
- El diario personal permanece accesible: **esta contraseña protege el panel, no es un candado del diario ni cifra IndexedDB**.
- Extensiones, scripts del mismo origen, herramientas de desarrollo o acceso al perfil/dispositivo pueden acceder a los datos. No hay recuperación de contraseña remota.
- `StorageManager.estimate()` muestra estimación del origen completo, no tamaño exacto de la base. El total de archivos sí se calcula por sus tamaños reales.
- `persist()` es una solicitud al navegador, no una garantía. El borrado del sitio o pérdida del perfil sigue eliminando los datos.
- Las cabeceras de archivo y MIME se validan; no es un antivirus ni una garantía de compatibilidad de codecs del navegador.

## Funcionamiento sin conexión y rendimiento

Fuentes DM Sans/DM Serif Display y las tres fotografías ilustrativas originales se distribuyen localmente. El service worker de producción conserva HTML, CSS, fuentes, imágenes y chunks de todas las rutas. La primera instalación requiere cargar el sitio mediante HTTPS o localhost; después se puede arrancar en ese mismo origen offline. El servidor Vite de desarrollo no instala el service worker para no interferir con HMR.

Las páginas se cargan de forma diferida; React, router, Dexie y validación tienen chunks independientes. El build corrige el `NODE_ENV=development` heredado del entorno para no distribuir React de desarrollo. Los cambios del service worker no fuerzan una recarga mientras se está escribiendo.

La lectura mantiene el conjunto de metadatos/textos en memoria, no los binarios completos. Las búsquedas textuales son locales y lineales; para bibliotecas grandes se recomienda paginación y un índice de búsqueda incremental en la siguiente fase.
