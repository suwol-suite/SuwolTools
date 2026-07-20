export type SqlDialect = "standard" | "mysql" | "postgresql" | "sqlite" | "mariadb";

const breakKeywords = [
  "SELECT",
  "FROM",
  "WHERE",
  "GROUP BY",
  "ORDER BY",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "INNER JOIN",
  "LEFT JOIN",
  "RIGHT JOIN",
  "FULL JOIN",
  "JOIN",
  "VALUES",
  "SET",
  "ON",
];

const upperKeywords = [
  "select",
  "from",
  "where",
  "group by",
  "order by",
  "having",
  "limit",
  "offset",
  "inner join",
  "left join",
  "right join",
  "full join",
  "join",
  "insert",
  "into",
  "update",
  "delete",
  "values",
  "set",
  "and",
  "or",
  "on",
  "as",
  "create",
  "table",
];

export function formatSql(input: string, _dialect: SqlDialect): string {
  let sql = minifySql(input);

  upperKeywords.forEach((keyword) => {
    sql = sql.replace(new RegExp(`\\b${keyword}\\b`, "gi"), keyword.toUpperCase());
  });

  breakKeywords.forEach((keyword) => {
    sql = sql.replace(new RegExp(`\\s+${keyword}\\b`, "g"), `\n${keyword}`);
  });

  sql = sql
    .replace(/\s*,\s*/g, ",\n  ")
    .replace(/\s+(AND|OR)\s+/g, "\n  $1 ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim();

  return sql
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");
}

export function minifySql(input: string): string {
  return input.replace(/\s+/g, " ").replace(/\s*([(),=<>])\s*/g, "$1").trim();
}
