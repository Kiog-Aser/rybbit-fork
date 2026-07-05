FROM clickhouse/clickhouse-server:25.4.2

COPY akash/clickhouse/network.xml /etc/clickhouse-server/config.d/network.xml
COPY akash/clickhouse/enable_json.xml /etc/clickhouse-server/config.d/enable_json.xml
COPY akash/clickhouse/logging_rules.xml /etc/clickhouse-server/config.d/logging_rules.xml
COPY clickhouse/akash-config.xml /etc/clickhouse-server/config.d/akash-lean.xml