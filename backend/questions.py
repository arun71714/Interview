SQL_CONTEXT = (
    "Available tables (SQLite): EngineeringTag(tag_id, tag_name, discipline, model_id) | "
    "PI_TAGS(pi_tag, description, unit) | "
    "ObjectRevision(object_id, revision_no, revised_at, status) | "
    "ProjectObject(object_id, project, discipline) | "
    "TagQuality(tag_id, project, discipline, IsComplete) | "
    "TagData(discipline, tag_name, unit, description). "
    "EngineeringTag.tag_name maps to PI_TAGS.pi_tag."
)

PY_CONTEXT = (
    "A file 'tags.csv' exists in the working directory with columns: "
    "tag_id, tag_name, discipline, unit, description, last_update. "
    "pandas is available. Print your output to verify results."
)

SQLITE_SEED = """
CREATE TABLE EngineeringTag(tag_id INTEGER, tag_name TEXT, discipline TEXT, model_id INTEGER);
CREATE TABLE PI_TAGS(pi_tag TEXT, description TEXT, unit TEXT);
CREATE TABLE ObjectRevision(object_id INTEGER, revision_no INTEGER, revised_at TEXT, status TEXT);
CREATE TABLE ProjectObject(object_id INTEGER, project TEXT, discipline TEXT);
CREATE TABLE TagQuality(tag_id INTEGER, project TEXT, discipline TEXT, IsComplete INTEGER);
CREATE TABLE TagData(discipline TEXT, tag_name TEXT, unit TEXT, description TEXT);

INSERT INTO EngineeringTag VALUES
 (1,'FT-1001','Process',10),(2,'PT-2001','Process',10),(3,'TT-3001','Mechanical',11),
 (4,'LT-4001','Mechanical',11),(5,'XV-5001','Electrical',12),(6,'FT-1002','Process',10),
 (7,'PT-2002','Electrical',12),(8,'TT-3002','Mechanical',11);
INSERT INTO PI_TAGS VALUES
 ('FT-1001','Flow transmitter feed line','kg/h'),('PT-2001','Pressure transmitter reactor',NULL),
 ('TT-3001','Temperature transmitter','degC'),('XV-5001',NULL,'-'),
 ('FT-1002','Flow transmitter recycle','kg/h');
INSERT INTO ObjectRevision VALUES
 (100,1,'2024-01-05','Draft'),(100,2,'2024-02-10','Approved'),(100,3,'2024-02-10','Approved'),
 (101,1,'2024-01-15','Approved'),(101,2,'2024-03-01','Draft'),
 (102,1,'2024-02-20','Approved'),(102,2,'2024-04-11','Approved'),
 (103,1,'2024-03-30','Draft');
INSERT INTO ProjectObject VALUES
 (100,'ProjectX','Process'),(101,'ProjectX','Mechanical'),(102,'ProjectY','Process'),(103,'ProjectY','Electrical');
INSERT INTO TagQuality VALUES
 (1,'ProjectX','Process',1),(2,'ProjectX','Process',0),(3,'ProjectX','Mechanical',1),
 (4,'ProjectY','Mechanical',0),(5,'ProjectY','Electrical',1),(6,'ProjectX','Process',1),
 (7,'ProjectY','Electrical',0),(8,'ProjectX','Mechanical',1);
INSERT INTO TagData VALUES
 ('Process','FT-1001','kg/h','Flow transmitter feed line'),
 ('Process','PT-2001',NULL,'Pressure transmitter'),
 ('Process','FT-1001','kg/h','Flow transmitter feed line'),
 ('Mechanical','TT-3001','degC','Temperature transmitter'),
 ('Mechanical','TT-3001','degC',NULL),
 ('Mechanical','LT-4001','','Level transmitter'),
 ('Electrical','XV-5001','-','Shutoff valve'),
 ('Electrical','PT-2002','bar','');
"""

SET_A = {
    "title": "Set A — Advanced Data Analyst",
    "cutoff": 65,
    "strong": 75,
    "duration_minutes": 30,
    "questions": [
        {"qid": 1, "skill": "SQL joins", "level": "Medium", "marks": 5, "type": "sql", "context": SQL_CONTEXT,
         "question": "EngineeringTag(tag_id, tag_name, discipline, model_id) must be compared with PI_TAGS(pi_tag, description, unit). Write SQL to list engineering tags with no matching PI tag.",
         "rubric": "LEFT JOIN EngineeringTag to PI_TAGS on tag_name = pi_tag with WHERE pi_tag IS NULL, or NOT EXISTS / NOT IN pattern. Correct join key and anti-join logic. Expected result: LT-4001, PT-2002, TT-3002."},
        {"qid": 2, "skill": "SQL aggregation", "level": "Medium", "marks": 5, "type": "sql", "context": SQL_CONTEXT,
         "question": "Write SQL to calculate completeness percentage by discipline where a mapped tag is complete only when description and unit are both present.",
         "rubric": "GROUP BY discipline; conditional aggregation (SUM(CASE WHEN description IS NOT NULL AND unit IS NOT NULL ...)) divided by COUNT(*), *100. Handles NULL/blank checks. Join EngineeringTag to PI_TAGS or use TagData."},
        {"qid": 3, "skill": "DAX measure", "level": "Medium", "marks": 5, "type": "dax",
         "context": "Table TagQuality has column IsComplete (1/0). Dimension tables: Project, Discipline related to TagQuality.",
         "question": "Create a DAX measure for % Complete Tags using TagQuality[IsComplete] and ensure it responds correctly to Project and Discipline slicers.",
         "rubric": "Measure like DIVIDE(CALCULATE(COUNTROWS(TagQuality), TagQuality[IsComplete]=1), COUNTROWS(TagQuality)) or SUM/AVERAGE of IsComplete with DIVIDE. Must be a measure (not calculated column) so filter context from slicers applies. DIVIDE for divide-by-zero safety earns full marks."},
        {"qid": 4, "skill": "Power Query ETL", "level": "Medium", "marks": 5, "type": "text",
         "question": "A CSV export has duplicate tag rows, inconsistent column names, mixed date formats and blank units. List the Power Query cleaning steps.",
         "rubric": "Steps: promote/rename headers consistently, set data types, parse dates with locale/format handling, trim/clean text, normalise case, remove duplicates (after normalisation), replace blanks/nulls in units, filter invalid rows. Order matters: normalise before dedupe."},
        {"qid": 5, "skill": "Python pandas", "level": "Medium-High", "marks": 5, "type": "python", "context": PY_CONTEXT,
         "question": "Write pandas pseudo-code to read a tag CSV, normalise tag_name, keep the latest row per tag by last_update and export the cleaned file.",
         "rubric": "read_csv; normalise tag_name (str.strip().upper()); parse last_update with to_datetime; sort by last_update and drop_duplicates(subset='tag_name', keep='last') or groupby idxmax; to_csv export. Full marks for correct dedupe-latest logic."},
        {"qid": 6, "skill": "SQL window function", "level": "High", "marks": 5, "type": "sql", "context": SQL_CONTEXT,
         "question": "From ObjectRevision(object_id, revision_no, revised_at, status), return the latest revision per object. If revised_at ties, use highest revision_no.",
         "rubric": "ROW_NUMBER() OVER(PARTITION BY object_id ORDER BY revised_at DESC, revision_no DESC) = 1, or correlated subquery equivalent. Tie-breaker on revision_no must be present for full marks."},
        {"qid": 7, "skill": "Power BI model", "level": "Medium-High", "marks": 5, "type": "text",
         "question": "Describe a star schema for a dashboard using project, discipline, engineering objects, tag quality and change history.",
         "rubric": "Fact tables: TagQuality/ChangeHistory facts; dimensions: DimProject, DimDiscipline, DimEngineeringObject, DimDate. One-to-many single-direction relationships from dims to facts; avoid snowflaking/many-to-many; surrogate keys."},
        {"qid": 8, "skill": "Dashboard performance", "level": "Medium-High", "marks": 5, "type": "text",
         "question": "A report becomes slow after adding engineering object attributes. Give five improvement actions.",
         "rubric": "Any five of: remove unused columns, reduce cardinality, move attributes to dimension, use star schema, aggregate tables, avoid bi-directional relationships, measure optimisation (variables, avoid iterators), import vs DirectQuery review, Performance Analyzer diagnosis, limit visuals per page."},
        {"qid": 9, "skill": "Validation rules", "level": "Medium", "marks": 5, "type": "text",
         "question": "Define six validation rules for engineering tag data before publishing it to a dashboard.",
         "rubric": "Six rules e.g.: tag_name not null/unique per discipline, naming convention regex, unit present and from allowed list, description present, discipline in master list, valid dates (no future), referential integrity to PI tags, duplicate detection, row-count reconciliation vs source."},
        {"qid": 10, "skill": "DAX troubleshooting", "level": "High", "marks": 5, "type": "text",
         "question": "A completeness measure shows 100% for every discipline although raw data differs. What would you check first?",
         "rubric": "Check filter context: broken/missing relationship between discipline dim and fact, measure written as calculated column or with ALL()/REMOVEFILTERS removing filters, hardcoded values, IsComplete column all 1 after ETL, numerator=denominator logic error. Relationship + filter-context check first = full marks."},
        {"qid": 11, "skill": "Data integration", "level": "Medium-High", "marks": 5, "type": "text",
         "question": "Outline a nightly pipeline to ingest engineering model metadata from an API into a reporting dataset.",
         "rubric": "Scheduled job → API auth + pagination/incremental extraction → land raw (staging) → validate/transform → upsert into reporting DB/dataset → refresh Power BI dataset → logging, alerting, retries, row-count checks."},
        {"qid": 12, "skill": "KPI translation", "level": "Medium", "marks": 5, "type": "text",
         "question": "Translate \"Is engineering data ready for handover?\" into 4 measurable dashboard KPIs.",
         "rubric": "Four measurable KPIs e.g.: % tags complete (description+unit), % objects with approved latest revision, # open data-quality issues, % mapped tags vs PI, % disciplines above threshold, data freshness (days since update)."},
        {"qid": 13, "skill": "Lineage", "level": "Medium", "marks": 5, "type": "text",
         "question": "What metadata should be captured so a dashboard value can be traced back to source?",
         "rubric": "Source system/file name, extraction timestamp, batch/load id, transformation/version applied, source record key/ids, refresh datetime, dataset/measure version, owner. Enables end-to-end lineage."},
        {"qid": 14, "skill": "Python data quality", "level": "High", "marks": 5, "type": "python", "context": PY_CONTEXT,
         "question": "Using dataframe df(discipline, tag_name, unit, description), outline pandas logic to calculate completeness % by discipline where all three text fields are non-blank.",
         "rubric": "Treat NaN AND empty/whitespace strings as blank (fillna + str.strip != ''), boolean AND across the three fields, groupby('discipline').mean()*100. Handling of both NaN and blank strings distinguishes full marks."},
        {"qid": 15, "skill": "RLS", "level": "Medium-High", "marks": 5, "type": "text",
         "question": "How would you restrict a Power BI report so project teams only see their own project data?",
         "rubric": "Row-Level Security: roles with DAX filter on Project dim (e.g., [ProjectKey] = LOOKUPVALUE via USERPRINCIPALNAME()), dynamic RLS with user-project mapping table, assign AD groups in service, test with View As."},
        {"qid": 16, "skill": "Refresh issue", "level": "Medium-High", "marks": 5, "type": "text",
         "question": "Completeness drops from 92% to 60% after refresh. List eight technical checks.",
         "rubric": "Eight of: source row counts vs previous, schema/column changes, new source file/feed, nulls introduced upstream, date/locale parsing, join keys duplicating or dropping rows, filter/parameter changes, measure logic changes, partial/failed refresh, duplicates, incremental refresh window, gateway/credential issues."},
        {"qid": 17, "skill": "Documentation", "level": "Medium", "marks": 5, "type": "text",
         "question": "What should be documented for a Power BI dashboard so another analyst can maintain it?",
         "rubric": "Data sources + connections, refresh schedule/gateway, data model diagram + relationships, measure definitions (DAX) + business logic, KPI definitions, RLS roles, ETL steps, known issues, owners/contacts, change log."},
        {"qid": 18, "skill": "SQL data profiling", "level": "Medium-High", "marks": 5, "type": "sql", "context": SQL_CONTEXT,
         "question": "Write SQL/pseudo-SQL to find duplicate tag_name values by discipline and show duplicate count.",
         "rubric": "GROUP BY discipline, tag_name HAVING COUNT(*) > 1 with COUNT(*) shown. On TagData: FT-1001/Process (2) and TT-3001/Mechanical (2)."},
        {"qid": 19, "skill": "Power BI visual design", "level": "Medium", "marks": 5, "type": "text",
         "question": "For engineering leadership, what visuals would you include on the first dashboard page and why?",
         "rubric": "Executive summary: KPI cards (overall completeness/readiness %), trend line over time, bar by discipline/project, RAG status matrix, top issues table, slicers for project/discipline. Rationale: at-a-glance status, drill path."},
        {"qid": 20, "skill": "Issue resolution", "level": "Medium-High", "marks": 5, "type": "text",
         "question": "Two source files use different naming for the same discipline. How would you detect and correct it in the dataset?",
         "rubric": "Detect: distinct value profiling, fuzzy matching, reconciliation vs master discipline list. Correct: mapping/reference table applied in ETL (not manual edits), standardise at source long-term, add validation rule to catch future variants."},
    ],
}

SET_B = {
    "title": "Set B — Senior Data Analyst",
    "cutoff": 75,
    "strong": 85,
    "duration_minutes": 30,
    "questions": [
        {"qid": 1, "skill": "Solution architecture", "level": "High", "marks": 5, "type": "text",
         "question": "Design a governed solution to combine engineering model data, SQL reference data and Excel tracker data into a Power BI dashboard.",
         "rubric": "Layered architecture: ingestion (API/SQL/governed Excel via SharePoint or dataflow), staging + validation, curated warehouse/lakehouse model, shared semantic model, certified dataset, RLS, refresh orchestration, documentation and ownership. Governance of Excel intake is key."},
        {"qid": 2, "skill": "KPI governance", "level": "High", "marks": 5, "type": "text",
         "question": "Two disciplines define \"complete tag\" differently. How would you establish one KPI definition without stopping delivery?",
         "rubric": "Facilitate stakeholder workshop, document both definitions, agree interim: publish both as clearly-labelled variants or one standard + discipline exceptions, create KPI dictionary with sign-off, roadmap to converge, keep delivery running with transparent labelling."},
        {"qid": 3, "skill": "Technical leadership", "level": "Medium-High", "marks": 5, "type": "text",
         "question": "Two analysts produce different DAX logic for the same KPI. What would you do as Senior Data Analyst?",
         "rubric": "Review both against agreed business definition, test with known data, choose/standardise one in shared semantic model, document in measure dictionary, code review practice, no blame — use as mentoring opportunity, prevent recurrence via central certified measures."},
        {"qid": 4, "skill": "Data model review", "level": "High", "marks": 5, "type": "text",
         "question": "Review a proposed model with many-to-many joins between Project, Discipline and Tag tables. What risks do you see and how would you improve it?",
         "rubric": "Risks: ambiguous filter propagation, wrong/duplicated aggregates, performance issues, hard-to-debug totals. Improve: bridge tables, redesign to star schema with proper grain, single-direction one-to-many relationships, dimension conformance."},
        {"qid": 5, "skill": "SQL design", "level": "Medium-High", "marks": 5, "type": "sql", "context": SQL_CONTEXT,
         "question": "Write SQL logic to produce latest approved object revision per project and discipline. Mention where business rules matter.",
         "rubric": "Filter status='Approved', ROW_NUMBER() PARTITION BY object (join ProjectObject for project/discipline) ORDER BY revised_at DESC, revision_no DESC. Business rules: what counts as 'approved', tie-breaking, whether draft supersedes older approved, timezone/date rules."},
        {"qid": 6, "skill": "DAX design", "level": "High", "marks": 5, "type": "dax",
         "context": "TagQuality fact with IsComplete, related DimProject and DimDiscipline.",
         "question": "How would you build a DAX measure for readiness % that works at project, discipline and total levels without misleading totals?",
         "rubric": "Ratio-of-sums measure (DIVIDE(complete count, total count)) so totals aggregate correctly, not average of percentages. If weighted/iterated logic needed, SUMX over the right grain / ISINSCOPE handling. Explains why AVERAGEX of child percentages misleads totals."},
        {"qid": 7, "skill": "Performance management", "level": "High", "marks": 5, "type": "text",
         "question": "A dashboard is slow and used in leadership meetings. Describe your diagnostic sequence and corrective actions.",
         "rubric": "Sequence: Performance Analyzer → identify slow visuals/DAX vs model vs source; DAX Studio/server timings; check model size, cardinality, relationships. Fixes: optimise measures, reduce visuals, aggregations, star schema, incremental refresh, capacity check. Communicate + quick wins before meeting."},
        {"qid": 8, "skill": "Data contract", "level": "Medium-High", "marks": 5, "type": "text",
         "question": "What should be included in a data contract between engineering source owners and the reporting team?",
         "rubric": "Schema definition + data types, delivery schedule/SLA, quality thresholds, change-notification process, ownership/contacts, access method, volume expectations, handling of breaking changes, escalation path."},
        {"qid": 9, "skill": "Pipeline controls", "level": "High", "marks": 5, "type": "text",
         "question": "For nightly API ingestion, specify controls for reliability, schema drift and auditability.",
         "rubric": "Reliability: retries/backoff, idempotency, alerting, monitoring, checkpoint/incremental loads. Schema drift: schema validation on landing, contract tests, quarantine unexpected fields, versioned schemas. Auditability: batch ids, row counts source vs target, load logs, data retention of raw payloads."},
        {"qid": 10, "skill": "Quality framework", "level": "High", "marks": 5, "type": "text",
         "question": "Create a practical data-quality framework for engineering model data across projects.",
         "rubric": "Dimensions (completeness, validity, uniqueness, consistency, timeliness), rule catalogue per dataset, automated checks in pipeline, DQ scorecard/dashboard, thresholds + alerting, issue triage workflow, ownership/stewardship, continuous improvement cadence."},
        {"qid": 11, "skill": "Stakeholder management", "level": "Medium-High", "marks": 5, "type": "text",
         "question": "A project manager wants a green readiness status but data validation shows gaps. How would you handle it?",
         "rubric": "Do not manipulate data; present evidence factually, quantify gaps and impact, offer remediation plan + timeline, escalate via governance if pressured, show status with caveats/notes rather than falsifying. Integrity + constructive path forward."},
        {"qid": 12, "skill": "Mentoring", "level": "Medium", "marks": 5, "type": "text",
         "question": "How would you upskill junior analysts in SQL, Power BI modelling and data validation while delivering project work?",
         "rubric": "Pairing/code reviews on real tickets, graduated task assignment, reusable templates/standards, short focused sessions, documentation as learning, shadowing, feedback loops — learning embedded in delivery, not separate."},
        {"qid": 13, "skill": "Security/governance", "level": "Medium-High", "marks": 5, "type": "text",
         "question": "Design Power BI access for project teams, central leadership and external reviewers.",
         "rubric": "Workspaces + apps with AD security groups; RLS for project teams (own project only); leadership: all-project access via app audience; external reviewers: guest (B2B) access with restricted audience/export limits, sensitivity labels, audit logging."},
        {"qid": 14, "skill": "Change control", "level": "High", "marks": 5, "type": "text",
         "question": "How would you manage changes to KPI logic already used in leadership reporting?",
         "rubric": "Change request + impact analysis, stakeholder approval/governance board, versioned measure definitions, parallel run/restated history where needed, communication before release, release notes, effective-date documentation."},
        {"qid": 15, "skill": "Root cause analysis", "level": "High", "marks": 5, "type": "text",
         "question": "Completeness drops sharply after refresh. Describe how you would lead RCA and communication.",
         "rubric": "Immediate: flag known issue to consumers, freeze conclusions. RCA: compare snapshots, trace pipeline stage-by-stage, isolate source vs transform vs model, timeline of changes. Fix + validate + backfill. Communicate cause, impact, prevention; blameless postmortem."},
        {"qid": 16, "skill": "Semantic model standards", "level": "Medium-High", "marks": 5, "type": "text",
         "question": "List standards you would enforce in shared Power BI semantic models.",
         "rubric": "Naming conventions, measure folder organisation + descriptions, star schema only, hidden key columns, no calculated columns where measures suffice, format strings, certified/endorsed datasets, documentation, version control (pbip/TMDL), RLS standards, deployment pipelines."},
        {"qid": 17, "skill": "Governed Excel intake", "level": "Medium-High", "marks": 5, "type": "text",
         "question": "Excel tracker data is important but manually maintained. How would you reduce risk while still using it?",
         "rubric": "Template with locked structure + data validation lists, stored in controlled SharePoint location, single owner, versioning, automated ingestion with schema/quality validation and rejection reports, audit of changes, roadmap to replace with proper app/form."},
        {"qid": 18, "skill": "Testing strategy", "level": "High", "marks": 5, "type": "text",
         "question": "Define a test strategy before publishing a dashboard used for project handover decisions.",
         "rubric": "Data reconciliation vs source, measure/DAX unit tests with known datasets, edge cases (nulls, empty filters), RLS testing per role, performance testing, UAT with business sign-off, refresh testing, regression checks after changes, documented test evidence."},
        {"qid": 19, "skill": "Prioritisation", "level": "Medium-High", "marks": 5, "type": "text",
         "question": "You have limited analyst capacity and many dashboard requests. How would you prioritise?",
         "rubric": "Framework: business impact/value vs effort, alignment to strategic goals, deadlines/regulatory needs, reuse potential, sponsor engagement; transparent backlog, stakeholder communication of trade-offs, quick wins vs strategic work balance."},
        {"qid": 20, "skill": "Executive communication", "level": "Medium-High", "marks": 5, "type": "text",
         "question": "Write the key points you would communicate to leadership when dashboard data has known limitations.",
         "rubric": "What is reliable vs not (scope of limitation), quantified impact, root cause in plain language, workaround/interim guidance, remediation plan + ETA, whom to contact — concise, honest, decision-focused framing."},
    ],
}

QUESTION_SETS = {"A": SET_A, "B": SET_B}
