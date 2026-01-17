import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function MessageList({ messages }: { messages: Message[] }) {
  return (
    <div className="space-y-4">
      {messages.map((message, idx) => {
        const isAssistant = message.role === 'assistant';
        return (
          <div key={idx} className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[85%] p-3 rounded-lg ${isAssistant ? 'bg-chat-bubble-bg text-gray-900 dark:text-gray-100' : 'bg-blue-600 text-white'}`}>
              <ReactMarkdown
                className="prose prose-sm max-w-none"
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <SyntaxHighlighter style={oneLight} language={match[1]} PreTag="div" {...props}>
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>{children}</code>
                    );
                  }
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          </div>
        );
      })}
    </div>
  );
}
