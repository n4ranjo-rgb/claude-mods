# Token Coach · mod para Claude Code

Te recomienda **qué modelo y qué esfuerzo usar en cada prompt** para no gastar tokens de más. Lo muestra en un **panel a la derecha** con el **logo de Claude animado**.

- **0 tokens extra.** El análisis del prompt es local, con reglas. No llama a ningún modelo.
- **Tiene en cuenta la caché.** Cambiar de modelo o de esfuerzo invalida la caché de prompts. El modo automático solo cambia si, contando esa reescritura, ahorras más de un 20 % en los próximos 3 turnos.
- **Nunca gasta más por su cuenta.** En modo automático solo **baja** modelo o esfuerzo. Si recomienda subir, te lo sugiere y tú decides con «Fijar».
- **Mide lo real.** Muestra los tokens del último turno, el % de acierto de caché, el contexto aproximado, el gasto estimado de la sesión (equivalente en precios de la API) y el ahorro frente a tu configuración.

## Instalar (una vez, para todas tus sesiones)

En el prompt de Claude Code, en tu terminal:

```
/plugin install token-coach --marketplace n4ranjo-rgb/claude-mods
```

Responde `y` para añadir el marketplace y elige el alcance **user**. Así se carga en todas tus sesiones y en todos tus proyectos.

Desde una shell:

```
claude plugin install token-coach --marketplace n4ranjo-rgb/claude-mods
```

> Si el repositorio es privado, tu equipo necesita acceso de lectura en GitHub y una credencial de git configurada (SSH o `gh auth login` + `gh auth setup-git`).

**Ver el panel a la derecha:** el panel se acopla al lado del chat cuando la terminal está en modo pantalla completa y tiene al menos 110 columnas (144 para que se abra solo al empezar). Con menos espacio aparece encima del prompt, en versión compacta. En la app de escritorio el logo se anima con SVG.

## Claude Code en la web (claude.ai/code)

Funciona en cualquier navegador, aunque tu equipo sea antiguo. En **Editar entorno de nube → Setup script** pega:

```
claude plugin marketplace add n4ranjo-rgb/claude-mods
claude plugin install token-coach@n4ranjo-mods --scope user
```

Guarda los cambios. Cada sesión nueva de ese entorno lo instala sola, siempre en su última versión.

En la web todavía no se pueden dibujar paneles, así que no hay panel lateral ni logo animado. A cambio:

- `/coach` muestra un informe en texto: recomendación del último prompt, lo que se aplicó, tokens, caché y ahorro.
- `/coach <tu tarea>` analiza una tarea y te dice qué modelo y esfuerzo usar, sin gastar tokens del modelo.
- Cuando un prompt necesitaba menos, aparece un aviso de una línea con los comandos `/model …` y `/effort …` para cambiar. Ese aviso no lo lee el modelo, así que no cuesta tokens.
- El modo automático (`/coach auto`) funciona igual que en la terminal.

## Uso

| Acción | Cómo |
| --- | --- |
| Abrir el panel (o el informe en texto en la web) | `/coach` |
| Analizar una tarea sin gastar tokens | `/coach <tu tarea>` |
| Modo automático (aplica la recomendación cuando compensa) | `/coach auto` o tecla `m` en el panel |
| Solo sugerencias (por defecto) | `/coach sugerir` |
| Fijar la recomendación actual (permite subir) | tecla `f` → «Fijar» |
| Quitar lo fijado y reiniciar estadísticas | `/coach reset` |

La recomendación también aparece en la línea de estado: `◆ Coach: Sonnet 5.5 · medio`.

## Cómo decide

| Tipo de prompt | Recomendación |
| --- | --- |
| Conversación, renombrar, formatear, traducir, resumir, mensaje de commit | Haiku 5.5 · bajo |
| Preguntas y explicaciones | Haiku 5.5 · medio |
| Código acotado: implementar, arreglar un bug, tests | Sonnet 5.5 · medio |
| Refactor, arquitectura, migración, seguridad, rendimiento | Opus 5.5 · alto |
| Trabajo a fondo, desde cero, auditoría, producción | Opus 5.5 · muy alto |
| Investigación profunda, máximo razonamiento (solo si lo pides) | Fable 5.1 · alto |

Ajustes: «rápido», «simple» o «solo» bajan un nivel. Tres archivos o más, un prompt largo o «con cuidado» suben un nivel.

Precios usados (USD por millón de tokens, entrada / salida / lectura de caché): Haiku 5.5 0,10 / 0,50 / 0,01 · Sonnet 5.5 2 / 10 / 0,20 · Opus 5.5 4 / 20 / 0,20 · Fable 5.1 10 / 50 / 0,25.

## Seguridad

- Si tu proveedor no es la API de Anthropic (Bedrock, Vertex, gateway), el mod **no cambia el modelo**: solo puede ajustar el esfuerzo.
- Si un turno falla con el modelo que eligió, vuelve solo al modo sugerencia y te avisa.
- Nunca toca los subagentes, solo la conversación principal.

## Desarrollo

```
claude plugin validate plugins/token-coach
claude plugin test plugins/token-coach
```
