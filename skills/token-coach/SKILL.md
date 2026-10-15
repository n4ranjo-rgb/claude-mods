---
name: token-coach
description: Asesor de tokens. Recomienda qué modelo de Claude (Haiku, Sonnet, Opus o Fable) y qué nivel de esfuerzo (low, medium, high, xhigh, max) usar para una tarea, con el fin de gastar menos tokens sin perder calidad. Úsala cuando el usuario pregunte qué modelo o esfuerzo usar, cómo ahorrar tokens o uso, si una tarea merece Opus o basta Haiku/Sonnet, cuándo usar /compact o /clear, o escriba "/token-coach", "coach", "¿qué modelo uso?", "optimiza mis tokens", aunque no diga la palabra skill.
---

# Token Coach

Objetivo: decirle al usuario, en una tarjeta corta, **qué modelo y qué esfuerzo usar** para su tarea y **cómo aplicarlo**. Responde siempre en español y con brevedad: esta skill existe para ahorrar tokens, así que no gastes de más explicándola. No hagas la tarea: solo recomienda. Si el usuario quiere que también la hagas, recomienda primero y luego continúa.

## 1. Clasifica la tarea

Elige la **primera** fila que encaje, de arriba abajo:

| Nivel | Señales | Modelo · esfuerzo |
| --- | --- | --- |
| 7 | Pide explícitamente "lo máximo", "investigación profunda", "prueba formal", "el mejor modelo" | **Fable 5.1 · high** |
| 6 | A fondo, desde cero, app o sistema completo, auditoría, producción, estrategia, crítico | **Opus 5.5 · xhigh** |
| 5 | Refactor, arquitectura, diseño, migración, seguridad, rendimiento, concurrencia, cambios en muchos archivos, investigar un bug difícil | **Opus 5.5 · high** |
| 0 | Mecánico: renombrar, formatear, traducir, resumir, mensaje de commit, listar, regex sencilla, corregir un typo | **Haiku 5.5 · low** |
| 3 | Código acotado: implementar una función o componente, arreglar un bug localizado, escribir tests, CSS, una consulta SQL | **Sonnet 5.5 · medium** |
| 1 | Pregunta o explicación sin cambiar código | **Haiku 5.5 · medium** |
| 0 | Saludo o mensaje corto de conversación | **Haiku 5.5 · low** |
| — | Sin señales claras | **Sonnet 5.5 · medium**; **Opus 5.5 · medium** si el pedido es largo |

Escalera completa, de más barato a más potente (para subir o bajar niveles):
`Haiku·low → Haiku·medium → Sonnet·low → Sonnet·medium → Opus·medium → Opus·high → Opus·xhigh → Fable·high`

Ajustes (un paso cada uno en la escalera):
- **Baja** si dice "rápido", "simple", "solo", "breve", o es una pregunta corta.
- **Sube** si menciona 3 o más archivos, el pedido es muy largo y detallado, o pide "con mucho cuidado" o "meticuloso".
- Nunca llegues a Fable sumando ajustes: solo cuando se pide explícitamente lo máximo.

## 2. Comprueba si cambiar compensa

Cambiar de modelo o de esfuerzo a mitad de una conversación **invalida la caché de prompts**, y todo el contexto se vuelve a pagar a precio de entrada.
- Si la conversación ya es larga y el ahorro es pequeño (por ejemplo, Opus·medium → Opus·low o Opus → Sonnet para un solo mensaje), recomienda **quedarse** y dilo en una línea.
- Bajar a **Haiku** casi siempre compensa: cuesta unas 40 veces menos que Opus.
- Si la tarea nueva no tiene relación con la conversación actual, recomienda **empezar una conversación nueva** (o `/clear` en Claude Code) con el modelo recomendado: es lo que más ahorra.
- Conversación muy larga: sugiere `/compact` en Claude Code, o resumir y abrir un chat nuevo en la app.

Precios y detalles solo si el usuario los pide: `references/precios.md`.

## 3. Responde con esta tarjeta

Usa exactamente este formato, sin texto extra antes ni después salvo que el usuario pida más:

```
◆ TOKEN COACH
Tarea: <tipo de tarea en 2-5 palabras>
Recomendado: <Modelo> · esfuerzo <nivel>
Por qué: <una frase>
Ahorro: <p. ej. "≈40× menos que Opus" o "ya es la opción justa">
Cómo aplicarlo:
  • Claude Code: /model <id> y /effort <nivel>
  • App de Claude: selector de modelo → <Modelo>
<línea opcional ⚠ sobre caché, /compact o chat nuevo>
```

IDs para `/model`: `claude-haiku-5-5`, `claude-sonnet-5-5`, `claude-opus-5-5`, `claude-fable-5-1`. Niveles de `/effort`: `low`, `medium`, `high`, `xhigh`, `max`.

Si el usuario no dio una tarea concreta (solo dijo "coach" o "¿qué modelo uso?"), pregúntale en una línea qué va a hacer, o recomienda para la última tarea de la conversación.

## Ejemplos

**"renombra la variable x a total en utils.js"**
```
◆ TOKEN COACH
Tarea: cambio mecánico
Recomendado: Haiku 5.5 · esfuerzo low
Por qué: renombrar no necesita razonamiento profundo.
Ahorro: ≈40× menos que Opus
Cómo aplicarlo:
  • Claude Code: /model claude-haiku-5-5 y /effort low
  • App de Claude: selector de modelo → Haiku
```

**"refactoriza la arquitectura del módulo de pagos"**
```
◆ TOKEN COACH
Tarea: refactor de arquitectura
Recomendado: Opus 5.5 · esfuerzo high
Por qué: cambio de diseño que toca varios archivos; un error sale más caro que los tokens.
Ahorro: ya es la opción justa (Fable costaría ≈2,5× más)
Cómo aplicarlo:
  • Claude Code: /model claude-opus-5-5 y /effort high
  • App de Claude: selector de modelo → Opus
```
