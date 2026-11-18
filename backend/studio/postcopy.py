"""Creator-aware social post copy. Separate from burned-in spoken captions; no AI/API call is needed."""
import re
from . import roman

_GENERIC = {'viral', 'fyp', 'foryou', 'foryoupage', 'trending', 'explore', 'explorepage', 'viralreels', 'reels', 'shorts', 'clips'}
_QUESTIONS = {'funny': 'Which part got you? 😂', 'fail': 'What would you have done differently?',
              'clutch': 'Was that the right move?', 'rage': 'How would you react here?',
              'shock': 'What would your reaction be?', 'take': 'Do you agree with this take?',
              'story': 'What do you think about this moment?'}


def _plain(value, limit):
    text = re.sub(r'#[\w]+', '', str(value or ''))
    return re.sub(r'\s+', ' ', text).strip()[:limit]


def _tag(value):
    return re.sub(r'[^A-Za-z0-9_]', '', roman.to_roman(str(value))).strip('_')[:40]


def build(clip, creator):
    name = _plain(creator.get('name'), 80).lstrip('@')
    title = _plain(clip.get('title') or clip.get('hook'), 100) or 'A moment from the stream'
    if name and re.sub(r'\W', '', name.casefold()) not in re.sub(r'\W', '', title.casefold()):
        title = name + ' — ' + title
    title = title[:100].rstrip()
    description = _plain(clip.get('description'), 700)
    if description.casefold().strip('.!') == title.casefold().strip('.!'):
        description = ''
    footer = _plain(creator.get('post_footer'), 300)
    question = '' if '?' in description or '?' in title else _QUESTIONS.get(clip.get('category'), 'What do you think?')
    custom = re.findall(r'#?([\w]+)', str(creator.get('creator_hashtags') or ''))
    identity = custom[:3] if custom else ([_tag(name), _tag(name) + 'Clips'] if name else [])
    content = clip.get('hashtags') if isinstance(clip.get('hashtags'), list) else []
    embedded = re.findall(r'#([\w]+)', ' '.join(str(clip.get(k) or '') for k in ('title', 'description')) + ' ' + str(creator.get('post_footer') or ''))
    tags, seen = [], set()
    for raw in identity + content + embedded:
        tag = _tag(raw)
        if not tag or tag.casefold() in seen or (raw not in identity and tag.casefold() in _GENERIC):
            continue
        seen.add(tag.casefold());tags.append(tag)
        if len(tags) == 5:
            break
    # Keep room for the headline, attribution and hashtags on every supported platform.
    body = '\n\n'.join(x for x in (title, description, question, footer) if x)
    caption = body + ('\n\n' + ' '.join('#' + tag for tag in tags) if tags else '')
    return {'title': title, 'caption': caption, 'hashtags': tags}
