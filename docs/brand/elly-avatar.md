# Элли — промпты для аватара (мультяшный стиль)

Стиль: милый мультяшный робот-ассистентка в очках — плоская/векторная или
soft-3D иллюстрация (в духе стикерпаков Telegram), не фотореализм.
Цветовая палитра — под UI продукта: slate/indigo/amber (см. `src/lib/statuses.ts`).

## Основной промпт (аватар / профиль бота)

```
cute cartoon robot assistant character, kawaii chibi proportions, round
friendly head, big round rectangular black-rimmed glasses with soft glow,
large expressive eyes, small warm smile, matte white and soft lavender
body panels with rounded edges, tiny antenna with a small amber light,
holding a tiny clipboard or scale-of-justice icon, flat vector illustration
style with soft cel shading, clean pastel gradient background
(deep indigo to soft lavender), centered, simple bold shapes, sticker-style
outline, friendly professional legal-tech mascot, square composition
```

## Вариант 2 — теплее, более «домашний» помощник

```
adorable rounded cartoon robot girl assistant, oversized round glasses,
soft glowing amber eyes behind lenses, chibi style, pastel white and
periwinkle blue plating, small rounded antenna with heart-shaped or
star-shaped light tip, gentle closed-eye smile, sitting pose hugging a
small folder icon, flat illustration, soft shadows, warm pastel
background gradient (cream to lavender), Telegram sticker aesthetic,
minimal clean linework
```

## Вариант 3 — «alert» экспрессия (для просроченных задач/ошибок)

```
same cute cartoon robot assistant character (round glasses, amber eyes,
white-lavender body), slightly worried/attentive expression, one hand
raised near chin, small exclamation mark or clock icon floating nearby,
flat vector sticker style, soft cel shading, same color palette as base
avatar for consistency, transparent or soft pastel background
```

## Вариант 4 — «success» экспрессия (подтверждение/тест прошёл)

```
same cute cartoon robot assistant character (round glasses, amber eyes,
white-lavender body), cheerful expression with a small checkmark or
thumbs-up gesture, sparkle accents, flat vector sticker style, soft cel
shading, same color palette as base avatar, transparent or soft pastel
background
```

## Технические заметки

- **Модель:** для этого стиля не подходит `soul_cast` (даёт кинематографичный
  фотореализм — см. первую попытку). Лучше `nano_banana_pro` или любая
  модель с поддержкой flat/vector-иллюстрации и `aspect_ratio: "1:1"`.
- **Консистентность серии** (базовый аватар + alert + success как в
  вариантах 3–4): передавать первый успешный рендер как референс
  (`medias: [{ value: <job_id или media_id>, role: "reference"/"character" }]`),
  чтобы сохранить лицо/палитру между вариантами.
- **Негативные указания** (если модель поддерживает `negative_prompt`):
  избегать `photorealistic, human skin, realistic metal texture, dark/gritty,
  sci-fi horror, uncanny valley`.
- **Назначение файлов:** квадратный 1:1 — под аватар Telegram-бота и иконку
  в Настройки → Уведомления; alert/success-варианты — опционально, как
  реакции в истории уведомлений (`sent`/`error`/`skipped` в
  `docs/notifications.md`).
