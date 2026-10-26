import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Theme } from '../../constants/theme';

interface MarkdownRendererProps {
  content: string;
  isUser?: boolean;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, isUser }) => {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let tableRows: string[][] = [];

  const flushTable = (keyPrefix: string) => {
    if (tableRows.length > 0) {
      const isHeader = (idx: number) => idx === 0;
      elements.push(
        <View key={`${keyPrefix}-table`} style={styles.table}>
          {tableRows.map((row, rIdx) => (
            <View
              key={`${keyPrefix}-tr-${rIdx}`}
              style={[
                styles.tableRow,
                isHeader(rIdx) ? styles.tableHeaderRow : rIdx % 2 === 1 ? styles.tableAltRow : null,
              ]}
            >
              {row.map((cell, cIdx) => (
                <View key={`${keyPrefix}-td-${rIdx}-${cIdx}`} style={styles.tableCell}>
                  <Text
                    style={[
                      styles.tableCellText,
                      isHeader(rIdx) && styles.tableHeaderCellText,
                      isUser && styles.userText,
                    ]}
                  >
                    {renderInline(cell.trim(), isUser)}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      );
      tableRows = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Check for Markdown Table Rows
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());

      // Skip separator row (|---|---|)
      if (cells.every((c) => /^[-:]+$/.test(c))) {
        return;
      }

      tableRows.push(cells);
      return;
    }

    // Flush any pending table
    flushTable(`line-${idx}`);

    // Empty line
    if (!trimmed) {
      elements.push(<View key={`spacer-${idx}`} style={{ height: 6 }} />);
      return;
    }

    // Headers
    if (trimmed.startsWith('### ')) {
      elements.push(
        <Text
          key={`h3-${idx}`}
          style={[styles.h3, isUser ? styles.userText : null]}
        >
          {renderInline(trimmed.slice(4), isUser)}
        </Text>
      );
      return;
    }

    if (trimmed.startsWith('## ')) {
      elements.push(
        <Text
          key={`h2-${idx}`}
          style={[styles.h2, isUser ? styles.userText : null]}
        >
          {renderInline(trimmed.slice(3), isUser)}
        </Text>
      );
      return;
    }

    if (trimmed.startsWith('# ')) {
      elements.push(
        <Text
          key={`h1-${idx}`}
          style={[styles.h1, isUser ? styles.userText : null]}
        >
          {renderInline(trimmed.slice(2), isUser)}
        </Text>
      );
      return;
    }

    // Unordered bullet item (- item or * item)
    const bulletMatch = line.match(/^(\s*)[-*•]\s+(.+)$/);
    if (bulletMatch) {
      elements.push(
        <View key={`bullet-${idx}`} style={styles.listItem}>
          <Text style={[styles.bullet, isUser && styles.userText]}>•</Text>
          <Text style={[styles.listContent, isUser && styles.userText]}>
            {renderInline(bulletMatch[2], isUser)}
          </Text>
        </View>
      );
      return;
    }

    // Ordered list item (1. item)
    const orderMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
    if (orderMatch) {
      elements.push(
        <View key={`order-${idx}`} style={styles.listItem}>
          <Text style={[styles.orderNumber, isUser && styles.userText]}>
            {orderMatch[2]}.
          </Text>
          <Text style={[styles.listContent, isUser && styles.userText]}>
            {renderInline(orderMatch[3], isUser)}
          </Text>
        </View>
      );
      return;
    }

    // Standard paragraph line
    elements.push(
      <Text
        key={`p-${idx}`}
        style={[styles.paragraph, isUser && styles.userText]}
      >
        {renderInline(line, isUser)}
      </Text>
    );
  });

  flushTable('final');

  return <View style={styles.container}>{elements}</View>;
};

function renderInline(text: string, isUser?: boolean): React.ReactNode {
  // Regex to split bold, italic, code
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);

  return tokens.map((token, i) => {
    // Bold
    if (token.startsWith('**') && token.endsWith('**')) {
      return (
        <Text
          key={`b-${i}`}
          style={[styles.bold, isUser && styles.userText]}
        >
          {token.slice(2, -2)}
        </Text>
      );
    }

    // Italic
    if (token.startsWith('*') && token.endsWith('*')) {
      return (
        <Text
          key={`i-${i}`}
          style={[styles.italic, isUser && styles.userText]}
        >
          {token.slice(1, -1)}
        </Text>
      );
    }

    // Inline Code
    if (token.startsWith('`') && token.endsWith('`')) {
      return (
        <Text
          key={`c-${i}`}
          style={[styles.inlineCode, isUser && styles.userCode]}
        >
          {token.slice(1, -1)}
        </Text>
      );
    }

    return token;
  });
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 20,
    color: Theme.colors.text,
  },
  userText: {
    color: '#ffffff',
  },
  h1: {
    fontSize: 17,
    fontWeight: '700',
    color: Theme.colors.text,
    marginVertical: 4,
  },
  h2: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.text,
    marginVertical: 4,
  },
  h3: {
    fontSize: 15,
    fontWeight: '600',
    color: Theme.colors.text,
    marginVertical: 2,
  },
  bold: {
    fontWeight: '700',
  },
  italic: {
    fontStyle: 'italic',
  },
  inlineCode: {
    fontFamily: 'monospace',
    backgroundColor: '#F1F3F5',
    color: '#D93025',
    paddingHorizontal: 4,
    borderRadius: 4,
    fontSize: 12,
  },
  userCode: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    color: '#fff',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 2,
    paddingLeft: 4,
  },
  bullet: {
    fontSize: 14,
    lineHeight: 20,
    width: 14,
    color: Theme.colors.primary,
    fontWeight: '700',
  },
  orderNumber: {
    fontSize: 13,
    lineHeight: 20,
    minWidth: 16,
    marginRight: 4,
    color: Theme.colors.primary,
    fontWeight: '600',
  },
  listContent: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: Theme.colors.text,
  },
  table: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
    marginVertical: 6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tableHeaderRow: {
    backgroundColor: '#F7FAFC',
    borderBottomWidth: 2,
    borderBottomColor: '#CBD5E0',
  },
  tableAltRow: {
    backgroundColor: '#F8FAFC',
  },
  tableCell: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableCellText: {
    fontSize: 12,
    color: Theme.colors.text,
  },
  tableHeaderCellText: {
    fontWeight: '700',
    color: Theme.colors.text,
  },
});
