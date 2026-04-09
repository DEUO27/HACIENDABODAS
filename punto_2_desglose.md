# Punto 2 — Desarrollo pendiente del proyecto

Según el documento del proyecto, el **Punto 2** corresponde al módulo operativo del evento: **Dashboard Central + Gestión de Invitados + Envío Automatizado de Invitaciones + Sistema de Confirmación + Métricas en Tiempo Real**.  
La parte de **Dashboard y Leads** que ya tienen lista corresponde al **Punto 3 (Módulos de Gestión Comercial: Leads y CRM)**.

---

## 2A) Dashboard Central del evento (operación)

### Objetivo
Que el staff pueda ver en un solo lugar el estado general del evento:
- invitaciones enviadas
- confirmadas
- rechazadas
- pendientes
- métricas en tiempo real
- exportación de información operativa

### Entregables
- Selector de **evento activo** (si habrá varios eventos)
- KPIs principales:
  - Total invitados
  - Invitaciones enviadas
  - Confirmados
  - Rechazados
  - Pendientes
- Tabla/listado general de invitados con estados
- Acceso rápido a exportaciones

---

## 2B) Gestión de invitados (Guest List)

### Objetivo
Cargar, editar, organizar y consultar listas de invitados de forma eficiente.

### Entregables
- Importador de listas desde **Excel/CSV**
- CRUD de invitados:
  - crear
  - editar
  - eliminar
  - manejar duplicados
- Segmentación por:
  - grupo
  - mesa
  - etiquetas (VIP, familia, staff, etc.)
- Búsqueda avanzada
- Filtros por estado, grupo, mesa, nombre, teléfono, etc.
- Exportación en:
  - Excel
  - PDF
  - CSV

---

## 2C) Envío automatizado de invitaciones

### Objetivo
Enviar invitaciones masivas y personalizadas por diferentes canales.

### Canales contemplados en el documento
- WhatsApp
- Email
- SMS

### Entregables
- Editor de plantilla de mensaje
- Variables dinámicas como:
  - `{nombre}`
  - `{evento}`
  - `{fecha}`
  - `{link_confirmacion}`
- Selección de canal de envío
- Envío segmentado por grupo/mesa/tag
- Programación de envío:
  - enviar ahora
  - agendar para después
- Registro de envíos:
  - enviado
  - fallido
  - pendiente
  - fecha/hora
  - canal usado
- Reintentos controlados
- Control de ritmo de envío (throttling)

---

## 2D) Sistema de confirmación con token de seguridad

### Objetivo
Que cada invitado reciba un enlace único para confirmar su asistencia de forma sencilla y segura.

### Entregables
- Generación de **token único por invitado**
- Creación de enlace único de confirmación
- Página pública/mobile-first para confirmar:
  - Confirmo asistencia
  - No puedo asistir
- Opcionales útiles:
  - número de acompañantes
  - comentario
  - restricciones alimentarias
- Sincronización automática con el dashboard
- Seguridad mínima:
  - tokens difíciles de adivinar
  - expiración opcional
  - validación de uso
  - protección básica contra abuso

---

## 2E) Métricas en tiempo real

### Objetivo
Monitorear en tiempo real el estado del evento y la respuesta de los invitados.

### Entregables
- KPIs en vivo:
  - Total invitados vs confirmados
  - Tasa de rechazos
  - Tasa de pendientes
- Visualización rápida de evolución del evento
- Reportes descargables y editables
- Opcional:
  - timeline de confirmaciones por día/hora

---

# Orden recomendado para construir el MVP

## Fase 1
### Gestión de invitados
Primero tener lista, importación, edición, segmentación y estados.

## Fase 2
### Tokens + página de confirmación
Después conectar cada invitado con su enlace único de confirmación.

## Fase 3
### Envío automatizado
Arrancar con **un canal primero** (idealmente WhatsApp o Email) y luego expandir a SMS.

## Fase 4
### Dashboard del evento + métricas
Una vez que ya existan invitados, envíos y confirmaciones, construir la capa visual operativa.

## Fase 5
### Exportaciones y pulido
Excel, PDF, CSV, validaciones y mejoras finales.

---

# Resumen corto

## Lo que ya está listo
- Punto 3: **Leads y CRM**

## Lo que falta del Punto 2
- Dashboard Central del evento
- Gestión de invitados
- Envío automatizado de invitaciones
- Sistema de confirmación con tokens
- Métricas en tiempo real

---

# Nota práctica
Si quieren aterrizar esto a desarrollo real, lo ideal sería convertir este punto 2 en:
- módulos
- historias de usuario
- backlog técnico
- criterios de aceptación por pantalla/flujo
