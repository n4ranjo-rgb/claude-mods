# claude-mods

Mi catálogo personal de mods y plugins para **Claude Code**. Este repositorio solo sirve para instalarlos: es un *marketplace* de Claude Code.

## Plugins

| Plugin | Qué hace |
| --- | --- |
| [`token-coach`](plugins/token-coach) | Recomienda modelo y esfuerzo en cada prompt y cuida tus tokens (análisis local, no gasta tokens). Panel lateral con el logo de Claude animado. |

## Instalar

En el prompt de Claude Code, en tu terminal:

```
/plugin install token-coach --marketplace n4ranjo-rgb/claude-mods
```

1. Responde `y` para añadir el marketplace `github:n4ranjo-rgb/claude-mods`.
2. Elige el alcance **user**: así queda activo en todas tus sesiones y proyectos.

Desde una shell:

```
claude plugin install token-coach --marketplace n4ranjo-rgb/claude-mods
```

En la app de escritorio, donde `/plugin` no funciona: pulsa **+** junto al cuadro del prompt → **Plugins** → **Add marketplace** con `n4ranjo-rgb/claude-mods` → **Add plugin**.

> **El repositorio es privado.** La instalación solo funciona en un equipo con una credencial de git para github.com. Configúrala una vez con una clave SSH, o con `gh auth login` y después `gh auth setup-git`. La instalación nunca pide la contraseña.

## Actualizar

Cuando haya cambios en este repositorio:

```
claude plugin update token-coach
```

Después ejecuta `/reload-plugins` en la sesión abierta, o abre una sesión nueva.

## Añadir un plugin nuevo

1. Crea una carpeta en `plugins/<nombre>/` con `.claude-plugin/plugin.json`, `hooks/hooks.json` y su módulo.
2. Añade una entrada en `.claude-plugin/marketplace.json`:
   ```json
   { "name": "<nombre>", "source": "./plugins/<nombre>", "description": "..." }
   ```
3. Comprueba que todo está bien:
   ```
   claude plugin validate .
   claude plugin validate plugins/<nombre>
   claude plugin test plugins/<nombre>
   ```
