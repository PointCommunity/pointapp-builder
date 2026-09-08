export function ValidationSummary({ issues }: { issues: string[] }) {
  if (issues.length === 0) return null;
  return (
    <section className="validation-errors global-validation" role="alert">
      <strong>Fix these fields before saving</strong>
      <ul>
        {issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
    </section>
  );
}
