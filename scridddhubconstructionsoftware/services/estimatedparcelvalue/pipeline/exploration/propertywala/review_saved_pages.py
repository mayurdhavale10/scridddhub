"""Extract listing cards from saved PropertyWala HTML; never promote to training."""
import argparse
import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin


class Node:
    def __init__(self, tag='', attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []

    def walk(self):
        yield self
        for child in self.children:
            if isinstance(child, Node):
                yield from child.walk()

    def text(self):
        return ' '.join(' '.join(c.text() if isinstance(c, Node) else c for c in self.children).split())


class Tree(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                break

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def parse(directory):
    response = json.loads((directory / 'response.json').read_text(encoding='utf-8'))
    if response.get('status') != 200 or response.get('challenge_markers_for_review'):
        return [], []
    raw = (directory / 'body.bin').read_bytes()
    tree = Tree(raw.decode('utf-8', errors='replace'))
    links = [{'text': n.text(), 'url': urljoin(response['url'], n.attrs['href']), 'rel': n.attrs.get('rel')}
             for n in tree.root.walk() if n.tag in ('a', 'link') and n.attrs.get('href')]
    rows = []
    market = next((name for slug, name in (
        ('location-mumbai_maharashtra', 'mumbai'), ('location-thane_maharashtra', 'thane'),
        ('location-kalyan_thane', 'kalyan')) if slug in response['url']), None)
    if market is None:
        return rows, links
    for card in tree.root.walk():
        if card.tag != 'article' or not re.fullmatch(r'P\d+', card.attrs.get('id', '')):
            continue
        nodes = list(card.walk())
        def field(cls):
            return next((n.text() for n in nodes if cls in n.attrs.get('class', '').split()), None)
        price, area = field('property-price'), field('areaUnit')
        price_match = re.fullmatch(r'[^\d]*([\d,.]+)\s*(L|Cr)?', price or '')
        area_match = re.fullmatch(r'([\d,.]+)\s*(SqFeet|SqMeters?|SqYards?|Acres?)', area or '')
        price_value = float(price_match[1].replace(',', '')) * {'L': 100000, 'Cr': 10000000, None: 1}[price_match[2]] if price_match else None
        area_value = float(area_match[1].replace(',', '')) * {'SqFeet': 1, 'SqMeter': 10.76391041671, 'SqYard': 9, 'Acre': 43560}[area_match[2].rstrip('s')] if area_match else None
        title = next((n.text() for n in nodes if n.tag in ('h2', 'h3')), None)
        listing_link = next((n.attrs['href'] for n in nodes if n.tag == 'a' and card.attrs['id'] in n.attrs.get('href', '')), None)
        rows.append({'source': 'propertywala', 'listing_id': card.attrs['id'], 'url': urljoin(response['url'], listing_link) if listing_link else None,
                     'requested_market': market,
                     'source_locality_label': title.removeprefix('Residential Plot for sale in ') if title else None,
                     'observed_at': response['observed_at'], 'title': title,
                     'price_original': price, 'area_original': area, 'price_rupees': price_value, 'area_sqft': area_value,
                     'recomputed_inr_sqft': price_value / area_value if price_value and area_value else None,
                     'card_text': card.text(), 'review_flags': [label for label, pattern in (
                         ('building_or_commercial_description', r'\b(apartments?|flats?|BHK|mall|shops?|constructed|floors)\b'),
                         ('land_use_review', r'\b(agricultur\w*|farm\w*)\b')) if re.search(pattern, card.text(), re.I)],
                     'source_page': response['url'], 'raw_path': str(directory / 'body.bin'),
                     'raw_sha256': hashlib.sha256(raw).hexdigest(), 'review_status': 'unreviewed_category_locality_staleness_and_duplicates',
                     'admitted_to_benchmark': False})
    return rows, links


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('root', type=Path)
    args = parser.parse_args()
    rows, links = [], []
    for directory in sorted(args.root.iterdir()):
        if (directory / 'body.bin').exists() and (directory / 'response.json').exists():
            cards, page_links = parse(directory)
            rows.extend(cards)
            links.extend(page_links)
    (args.root / 'observations.jsonl').write_text(''.join(json.dumps(r, ensure_ascii=False) + '\n' for r in rows), encoding='utf-8')
    (args.root / 'published_links.json').write_text(json.dumps(links, indent=2, ensure_ascii=False), encoding='utf-8')
    print(json.dumps({'observations': len(rows), 'distinct_ids': len({r['listing_id'] for r in rows}), 'numeric_price_area': sum(bool(r['price_rupees'] and r['area_sqft']) for r in rows)}))
    for row in rows:
        print(json.dumps({k: row[k] for k in ('listing_id', 'title', 'price_original', 'area_original')}))
    print('NEXT LINKS', [l['url'] for l in links if l['rel'] == 'next'])


if __name__ == '__main__':
    main()
