import React from 'react';
import { Typography, Box, Divider } from '@mui/material';

/**
 * 간단한 마크다운 렌더러 (외부 라이브러리 없이).
 * 지원: H1~H3, 볼드, 이탤릭, 인라인 코드, 코드블록, 리스트(순서/비순서), 수평선, 링크
 */
const SimpleMarkdown = ({ content }) => {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 코드 블록
    if (line.trimStart().startsWith('```')) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <Box
          key={elements.length}
          component="pre"
          sx={{
            bgcolor: 'grey.100',
            p: 2,
            borderRadius: 1,
            overflow: 'auto',
            fontSize: '0.85rem',
            fontFamily: 'monospace',
            my: 1,
            whiteSpace: 'pre-wrap',
          }}
        >
          <code>{codeLines.join('\n')}</code>
        </Box>
      );
      continue;
    }

    // 수평선
    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
      elements.push(<Divider key={elements.length} sx={{ my: 2 }} />);
      i++;
      continue;
    }

    // 빈 줄
    if (line.trim() === '') {
      elements.push(<Box key={elements.length} sx={{ height: 8 }} />);
      i++;
      continue;
    }

    // 헤딩
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const variants = { 1: 'h5', 2: 'h6', 3: 'subtitle1' };
      elements.push(
        <Typography
          key={elements.length}
          variant={variants[level]}
          sx={{ fontWeight: 700, mt: level === 1 ? 2 : 1.5, mb: 0.5 }}
        >
          {renderInline(headingMatch[2])}
        </Typography>
      );
      i++;
      continue;
    }

    // 순서 없는 리스트
    if (/^\s*[-*]\s+/.test(line)) {
      const listItems = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      elements.push(
        <Box key={elements.length} component="ul" sx={{ pl: 3, my: 0.5 }}>
          {listItems.map((item, j) => (
            <Typography key={j} component="li" variant="body2" sx={{ mb: 0.3 }}>
              {renderInline(item)}
            </Typography>
          ))}
        </Box>
      );
      continue;
    }

    // 순서 있는 리스트
    if (/^\s*\d+\.\s+/.test(line)) {
      const listItems = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      elements.push(
        <Box key={elements.length} component="ol" sx={{ pl: 3, my: 0.5 }}>
          {listItems.map((item, j) => (
            <Typography key={j} component="li" variant="body2" sx={{ mb: 0.3 }}>
              {renderInline(item)}
            </Typography>
          ))}
        </Box>
      );
      continue;
    }

    // 일반 텍스트
    elements.push(
      <Typography key={elements.length} variant="body2" sx={{ lineHeight: 1.7 }}>
        {renderInline(line)}
      </Typography>
    );
    i++;
  }

  return <Box>{elements}</Box>;
};

/** 인라인 서식: **볼드**, *이탤릭*, `코드`, [링크](url) */
function renderInline(text) {
  if (!text) return text;

  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // 링크 [text](url)
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
    // 볼드 **text**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // 이탤릭 *text*
    const italicMatch = remaining.match(/(?<!\*)\*([^*]+)\*(?!\*)/);
    // 인라인 코드 `text`
    const codeMatch = remaining.match(/`([^`]+)`/);

    // 가장 먼저 등장하는 패턴 찾기
    const matches = [
      linkMatch && { type: 'link', match: linkMatch },
      boldMatch && { type: 'bold', match: boldMatch },
      italicMatch && { type: 'italic', match: italicMatch },
      codeMatch && { type: 'code', match: codeMatch },
    ].filter(Boolean).sort((a, b) => a.match.index - b.match.index);

    if (matches.length === 0) {
      parts.push(remaining);
      break;
    }

    const first = matches[0];
    const before = remaining.slice(0, first.match.index);
    if (before) parts.push(before);

    switch (first.type) {
      case 'bold':
        parts.push(<strong key={key++}>{first.match[1]}</strong>);
        break;
      case 'italic':
        parts.push(<em key={key++}>{first.match[1]}</em>);
        break;
      case 'code':
        parts.push(
          <Box
            key={key++}
            component="code"
            sx={{ bgcolor: 'grey.100', px: 0.5, py: 0.2, borderRadius: 0.5, fontSize: '0.85em', fontFamily: 'monospace' }}
          >
            {first.match[1]}
          </Box>
        );
        break;
      case 'link':
        parts.push(
          <Box
            key={key++}
            component="a"
            href={first.match[2]}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ color: 'primary.main', textDecoration: 'underline' }}
          >
            {first.match[1]}
          </Box>
        );
        break;
    }

    remaining = remaining.slice(first.match.index + first.match[0].length);
  }

  return parts;
}

export default SimpleMarkdown;
