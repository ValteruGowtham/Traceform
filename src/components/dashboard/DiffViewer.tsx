export function DiffViewer({ diff }: { diff: string }) {
  return (
    <div className="code-block scroll-area">
      {diff.split('\n').map((line, i) => {
        let cls = '';
        if (line.startsWith('+') && !line.startsWith('+++')) cls = 'line-add';
        if (line.startsWith('-') && !line.startsWith('---')) cls = 'line-del';
        return (
          <div key={i} className={`code-line ${cls}`}>
            <span className="code-line-num">{i + 1}</span>
            <span>{line || ' '}</span>
          </div>
        );
      })}
    </div>
  );
}
