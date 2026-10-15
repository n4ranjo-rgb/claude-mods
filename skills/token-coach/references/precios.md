# Precios y criterios (API de Anthropic, octubre 2026)

USD por millón de tokens:

| Modelo | Entrada | Salida | Lectura de caché | Para qué |
| --- | --- | --- | --- | --- |
| Haiku 5.5 | 0,10 | 0,50 | ≈0,01 | Tareas mecánicas, preguntas, conversación. Por encima de 100K tokens de prompt: 0,50 / 2,50 |
| Sonnet 5.5 | 2 | 10 | 0,20 | Código cotidiano y agentes |
| Opus 5.5 | 4 | 20 | 0,20 | Diseño, refactors y depuración difícil. Su esfuerzo por defecto es `medium` |
| Fable 5.1 | 10 | 50 | 0,25 | El más capaz: razonamiento máximo y trabajo largo y autónomo |

- La escritura en caché cuesta unas 1,25 veces el precio de entrada.
- En los planes de suscripción (Pro/Max) no pagas por token, pero estos precios reflejan cuánto de tu límite de uso consume cada opción.

## Esfuerzo (effort)

- Controla cuánto piensa el modelo y cuántas llamadas a herramientas hace: es la principal palanca de gasto dentro de un mismo modelo.
- `low`: tareas simples y subagentes. `medium`: punto de partida para código. `high` o `xhigh`: trabajo agéntico largo o difícil. `max`: solo si la corrección importa más que el coste.
- Un modelo potente con esfuerzo bajo suele igualar a uno menor con esfuerzo alto. Antes de cambiar de modelo, prueba bajando el esfuerzo.

## Caché

- La caché depende del modelo: cambiar de modelo obliga a volver a escribir todo el contexto.
- Cambiar el esfuerzo a mitad de una conversación también puede invalidarla.
- Regla práctica: cambia solo si el ahorro de los próximos turnos supera el coste de reescribir el contexto. Con contextos de más de 100K tokens, casi nunca compensa un cambio pequeño.
