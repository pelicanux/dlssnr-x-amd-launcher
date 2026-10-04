import React from "react";

interface Props {
  logs: string;
}

/**
 * Component for displaying terminal-like logs.
 */
export const ConsoleLogger: React.FC<Props> = ({ logs }) => {
  if (!logs) return null;

  return (
    <div className="console">
      {logs}
    </div>
  );
};
