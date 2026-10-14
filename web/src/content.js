export const SITE_URL = "https://www.dean-da-dev.co.uk/quick-scan-first";
export const SITE_NAME = "Quick Scan First";
export const UPDATED = "2026-10-04";

export const pages = [
  {
    "image": "images/repository-security.webp",
    "imageWidth": 1536,
    "imageHeight": 1024,
    "imageAlt": "Quick Scan First robot reviewing repository files before release",
    "imageCaption": "Inspect the source evidence and test a proposed change before merging.",
    "slug": "ai-code-security-scanner",
    "kind": "Product guide",
    "title": "AI code security scanner for vibe-coded apps",
    "description": "Review GitHub code built with Cursor, Lovable, Claude or ChatGPT for exposed secrets, unsafe database rules and launch risks. Keep control of every proposed fix.",
    "answer": "Quick Scan First reviews a GitHub repository, including code written with AI coding tools. Built-in checks look for known risky patterns; an optional AI review examines authentication, ownership, payments and configuration. Findings and proposed pull requests need your review.",
    "sections": [
      [
        "Check the repository behind the AI-built app",
        "An app that looks finished can still contain a committed environment file, a privileged key in browser code or an API route without an ownership check. Export or connect the code to GitHub, then scan the repository you intend to release. The tool reviews source code rather than probing a live website."
      ],
      [
        "Built-in checks and deeper AI review",
        "Free scans include deterministic checks and the supported npm dependency check. Pro or credits enable deeper AI review. The review can flag likely issues across files, but it is not a proof of correctness and does not execute a penetration test."
      ],
      [
        "Fix prompts and reviewable pull requests",
        "Use the report to investigate the named file, copy a fix prompt into your coding tool, or request an AI-assisted fix. Proposed fixes are opened on a separate branch as pull requests. Check the diff, test the affected flow and merge only when you are satisfied."
      ],
      [
        "What the scanner can and cannot see",
        "Scans use a selected repository branch and a bounded set of relevant files. Large repositories may be partially reviewed. Quick Scan First does not audit the complete Git history, inspect your live database policies or run the application in a sandbox."
      ]
    ],
    "faqs": [
      [
        "Can I scan code built with Lovable or Cursor?",
        "Yes, when the code is available in a GitHub repository that your token can access. Quick Scan First scans that repository; it does not log into the app builder."
      ],
      [
        "Does Free include the AI review?",
        "Free scans use the built-in checks and supported dependency check. A deeper AI review requires Pro or credits."
      ],
      [
        "Does a clean report prove my app is secure?",
        "No. Review the scan coverage and findings, test critical flows, and use expert security testing where the risk calls for it."
      ]
    ],
    "related": [
      "github-repository-security-scanner",
      "supabase-rls-security-check",
      "pre-launch-code-review"
    ],
    "updated": "2026-10-14"
  },
  {
    "image": "images/repository-security.webp",
    "imageWidth": 1536,
    "imageHeight": 1024,
    "imageAlt": "Quick Scan First robot reviewing repository files before release",
    "imageCaption": "Inspect the source evidence and test a proposed change before merging.",
    "slug": "supabase-rls-security-check",
    "kind": "Product guide",
    "title": "Supabase RLS and Firebase rules checks before launch",
    "description": "Check repository SQL and Firebase rules for unsafe access patterns before launch. Understand what source checks reveal and what to verify in your live database.",
    "answer": "Quick Scan First checks relevant repository files for risky Firebase rules and Supabase SQL patterns, including disabled Row Level Security. It does not connect to your hosted database or confirm which policies are deployed. Verify the live project and test access separately.",
    "sections": [
      [
        "Look for unsafe database access in source files",
        "The built-in checks flag broad Firebase rules and SQL that explicitly disables Row Level Security. These patterns can signal a development shortcut that should be investigated before release. A finding is a starting point for reviewing who may read and change data."
      ],
      [
        "RLS enabled is only part of the review",
        "Row Level Security also needs policies that match the ownership and role requirements of the application. Review reads and writes, unauthenticated access and attempts by one user to access another user’s records. The deeper AI review can flag likely mistakes in relevant code; it does not verify every deployed policy."
      ],
      [
        "Check the actual project you will deploy",
        "Source files may differ from the live database configuration. Confirm the active rules, policies and project environment using the provider’s dashboard or CLI. Test with the real client roles rather than relying only on an administrator connection."
      ],
      [
        "Keep privileged credentials on the server",
        "Supabase service-role keys and other private credentials must not be shipped to a browser. Public client keys have a different purpose and require correctly enforced access policies. If a privileged credential is exposed, revoke or rotate it before cleaning the repository."
      ]
    ],
    "faqs": [
      [
        "Does Quick Scan First test my live Supabase database?",
        "No. It reviews repository source files. It does not connect to Supabase to enumerate deployed policies or query production tables."
      ],
      [
        "Does it review Firebase security rules?",
        "It can flag unsafe patterns in relevant repository rules files. Verify that the intended rules are deployed and test authorised and unauthorised access separately."
      ],
      [
        "Is turning RLS on enough?",
        "No. Review the applicable policies and test that users can access only the data their role and ownership permit."
      ]
    ],
    "related": [
      "blog/firebase-supabase-security-rules",
      "exposed-api-key-scanner",
      "ai-code-security-scanner"
    ],
    "sources": [
      {
        "label": "Supabase Row Level Security documentation",
        "url": "https://supabase.com/docs/guides/database/postgres/row-level-security"
      },
      {
        "label": "Firebase security rules documentation",
        "url": "https://firebase.google.com/docs/rules"
      }
    ],
    "updated": "2026-10-14"
  },
  {
    "image": "images/repository-security.webp",
    "imageWidth": 1536,
    "imageHeight": 1024,
    "imageAlt": "Quick Scan First robot reviewing repository files before release",
    "imageCaption": "Inspect the source evidence and test a proposed change before merging.",
    "slug": "npm-dependency-vulnerability-scanner",
    "kind": "Product guide",
    "title": "npm dependency vulnerability scanner for GitHub",
    "description": "Check supported npm package-lock files against OSV.dev for known vulnerabilities before launch. Review affected packages, fixes and the limits of a dependency scan.",
    "answer": "Quick Scan First reads a supported npm package-lock.json from the reviewed repository files and queries OSV.dev for known vulnerabilities in recorded package versions. It reports matching dependency risks for investigation; it does not install packages or prove that every reported issue is exploitable in your app.",
    "sections": [
      [
        "Check the versions recorded in the lockfile",
        "A dependency scan needs actual versions, rather than only a package name or broad version range. Keep the npm lockfile committed and current so a release review can compare the recorded versions with published vulnerability information."
      ],
      [
        "Known vulnerabilities and application context",
        "A matching advisory tells you to investigate the affected package and version. Review the advisory, whether the vulnerable code path is reachable, and the available remediation. A clean query does not exclude unpublished issues or application-logic vulnerabilities."
      ],
      [
        "Test dependency updates before release",
        "Check the fixed version and release notes, update the dependency and lockfile, then run tests and the production build. Do not assume that replacing a version number alone resolves every risk or preserves your application’s behaviour."
      ],
      [
        "Current package-manager coverage",
        "The implemented dependency check supports npm package-lock files. Yarn, pnpm and Python lockfile checks are not currently included. The repository scan has file-selection and size limits, so review the report’s coverage when working with large projects."
      ]
    ],
    "faqs": [
      [
        "Does the free scan include npm dependency checks?",
        "Yes. The supported npm dependency check is included with the built-in scan; the deeper AI code review is a separate Pro or credits feature."
      ],
      [
        "Does it support yarn.lock or pnpm-lock.yaml?",
        "Not currently. The implemented dependency check supports npm package-lock.json."
      ],
      [
        "Does Quick Scan First install or execute dependencies?",
        "No. This check reads the lockfile and queries vulnerability records. It is not a sandboxed install or runtime test."
      ]
    ],
    "related": [
      "github-repository-security-scanner",
      "pre-launch-code-review",
      "ai-code-security-scanner"
    ],
    "sources": [
      {
        "label": "OSV vulnerability database",
        "url": "https://osv.dev/"
      }
    ],
    "updated": "2026-10-14"
  },
  {
    "image": "images/repository-security.webp",
    "imageWidth": 1536,
    "imageHeight": 1024,
    "imageAlt": "Quick Scan First robot reviewing repository files before release",
    "imageCaption": "Inspect the source evidence and test a proposed change before merging.",
    "slug": "stripe-webhook-security-review",
    "kind": "Product guide",
    "title": "Stripe webhook and payment code review before launch",
    "description": "Use AI-assisted repository review to investigate Stripe webhook signatures, server-side payment checks and ownership mistakes before launching a paid app.",
    "answer": "Quick Scan First’s deeper AI review can flag likely payment and webhook implementation mistakes in the GitHub files it reviews. Use it alongside Stripe’s documentation and test-mode exercises. It does not connect to your Stripe account, process a payment or certify a checkout flow.",
    "sections": [
      [
        "Review the server-side payment boundary",
        "A browser-supplied amount, product or account identifier should not be trusted without server-side validation. Check that your application derives the expected payment details and verifies that the authenticated user may perform the requested action."
      ],
      [
        "Inspect webhook signature handling",
        "Review the code receiving Stripe events, including signature verification and the request body handling required by your server framework. A webhook endpoint should not accept an unverified request as proof that a customer has paid."
      ],
      [
        "Test repeat and delayed events",
        "Payment events can be retried or arrive after a user leaves the checkout page. Review idempotent processing and test that a repeated event does not grant an entitlement twice. Test success, failure and cancellation paths against the behaviour your product promises."
      ],
      [
        "Use AI findings as review prompts",
        "The deeper review requires Pro or credits and may miss context outside the selected files. Inspect the evidence and verify any generated pull request. This is code review, not a live payment audit or a guarantee that a billing system is correct."
      ]
    ],
    "faqs": [
      [
        "Are payment checks part of the free deterministic scan?",
        "Payment and webhook logic are covered by the deeper AI review on Pro or credits, rather than by a complete deterministic payment test."
      ],
      [
        "Does this tool connect to my Stripe account?",
        "No. It reviews repository code. Use Stripe test mode and your own integration tests to verify actual payment behaviour."
      ],
      [
        "Can I merge a generated fix without testing?",
        "Review the diff and test the relevant payment flows before merging. AI-generated fixes can be wrong."
      ]
    ],
    "related": [
      "pre-launch-code-review",
      "ai-code-security-scanner",
      "exposed-api-key-scanner"
    ],
    "sources": [
      {
        "label": "Stripe webhook signature verification",
        "url": "https://docs.stripe.com/webhooks/signature"
      }
    ],
    "updated": "2026-10-14"
  },
  {
    "image": "images/repository-security.webp",
    "imageWidth": 1536,
    "imageHeight": 1024,
    "imageAlt": "Quick Scan First robot reviewing repository files before release",
    "imageCaption": "Inspect the source evidence and test a proposed change before merging.",
    "slug": "compare-code-security-tools",
    "kind": "Buying guide",
    "title": "Compare GitHub code security tools for pre-launch review",
    "description": "Compare secret scanning, SAST, dependency checks and AI code review workflows. See where Quick Scan First fits without assuming one scanner replaces every tool.",
    "answer": "Choose a code security tool by the risk and workflow you need to cover. Secret detection, static analysis, dependency analysis, pull-request review and live application testing answer different questions. Quick Scan First focuses on a manual pre-launch GitHub scan and optional reviewable fixes.",
    "sections": [
      [
        "Secret detection and repository coverage",
        "GitGuardian and GitHub offer secret-detection workflows. Compare supported credential formats, repository history coverage, push protection, monitoring and remediation. Quick Scan First checks selected files from a branch snapshot and committed environment-file paths; it is not a full-history secret scanner."
      ],
      [
        "Static analysis and dependency scanning",
        "Snyk Code, Semgrep and SonarQube provide code-analysis products, while wider platform capabilities vary. Compare supported languages, analysis depth, dependency support, CI integration and triage. Quick Scan First combines a focused set of built-in checks with optional AI review; its implemented dependency check is limited to npm package-lock files."
      ],
      [
        "AI review and suggested fixes",
        "CodeRabbit and Qodo offer AI-assisted development and review workflows. Other security products also offer remediation, so proposed fixes are not unique to Quick Scan First. Compare when reviews run, the context available and how humans approve changes. Quick Scan First offers fix prompts and AI-assisted pull requests requested from a scan report."
      ],
      [
        "Test the fit for a small team or solo builder",
        "Quick Scan First is a Chrome extension with GitHub token access, GBP pricing and a limited Free allowance. It can suit an explicit review before launch. If you need continuous organisation-wide monitoring, a CI security gate, a live penetration test or compliance evidence, check those requirements separately."
      ]
    ],
    "faqs": [
      [
        "Is Quick Scan First a replacement for every security tool?",
        "No. Its repository review can complement other checks. Match each tool’s coverage to the risks, release workflow and assurance level you need."
      ],
      [
        "Do other scanners offer fixes?",
        "Yes. Several code-security and AI-review products offer remediation or suggested changes. Compare their current workflow and review controls instead of assuming they only list findings."
      ],
      [
        "Which tool is cheapest?",
        "Compare current plan limits, required features and total cost for your workload. Free allowances, per-developer subscriptions and enterprise plans are not directly interchangeable."
      ]
    ],
    "related": [
      "ai-code-security-scanner",
      "npm-dependency-vulnerability-scanner",
      "github-repository-security-scanner"
    ],
    "sources": [
      {
        "label": "GitHub security",
        "url": "https://github.com/security"
      },
      {
        "label": "GitGuardian secret detection",
        "url": "https://www.gitguardian.com/solutions/secret-detection"
      },
      {
        "label": "Snyk Code",
        "url": "https://snyk.io/product/snyk-code/"
      },
      {
        "label": "Semgrep",
        "url": "https://semgrep.dev/"
      },
      {
        "label": "SonarQube",
        "url": "https://www.sonarsource.com/products/sonarqube/"
      },
      {
        "label": "CodeRabbit",
        "url": "https://www.coderabbit.ai/"
      },
      {
        "label": "Qodo",
        "url": "https://www.qodo.ai/"
      }
    ],
    "updated": "2026-10-14"
  }
].concat([
  {
    slug: "github-repository-security-scanner",
    kind: "Product guide",
    title: "GitHub repository security scanner for pre-launch checks",
    description: "Scan a GitHub repository for exposed secrets, unsafe database rules, vulnerable dependencies, missing authentication checks and payment risks before launch.",
    image: "images/repository-security.webp",
    imageWidth: 1536,
    imageHeight: 1024,
    imageAlt: "Quick Scan First robot scanning connected repository files for security risks",
    imageCaption: "Repository-wide review helps connect risks that are easy to miss in a single file.",
    answer: "Quick Scan First is a Chrome extension that reviews a GitHub repository before launch. It combines deterministic security checks with an optional AI review, explains each finding, and can prepare a fix as a pull request that you approve.",
    sections: [
      ["What does a GitHub repository security scanner check?", "A useful pre-launch scan should check committed environment files, hardcoded API keys and private keys, open Firebase or Supabase access, known npm vulnerabilities, missing authentication and ownership checks, payment and webhook mistakes, and broken production configuration. Quick Scan First reports evidence from the files it reviewed so you can verify the result."],
      ["How Quick Scan First works", "Choose a repository with a fine-grained GitHub token, run the scan, then review the launch-readiness report. The built-in checks find known high-risk patterns. A deeper review can examine how authentication, payments and data access work across files. If a finding is suitable for an automated fix, Quick Scan First creates a separate branch and pull request."],
      ["What happens to source code?", "Repository files are processed for the scan and are not stored as a copy on Quick Scan First servers. Relevant files are sent to Anthropic only when an AI review or AI-assisted fix needs them. You remain responsible for reviewing every finding and pull request."],
      ["When should you run it?", "Run a scan before a first production launch, before a significant release, after changing authentication or database rules, after adding payments, and after rotating credentials. It is a focused second pair of eyes rather than a replacement for penetration testing or a formal security audit."],
    ],
    faqs: [
      ["Can Quick Scan First scan private GitHub repositories?", "Yes. The fine-grained token must be limited to and authorised for the repositories you choose."],
      ["Does the scanner change code automatically?", "No. A proposed fix is placed on a new branch and opened as a pull request. Nothing changes until you review and merge it."],
      ["Is this a penetration test?", "No. It is an automated pre-launch code review and cannot guarantee that an application is secure."],
    ],
    related: ["pre-launch-code-review", "exposed-api-key-scanner", "blog/github-security-checklist-before-launch"],
  },
  {
    slug: "pre-launch-code-review",
    kind: "Product guide",
    title: "Pre-launch code review for web apps",
    description: "Use a repeatable pre-launch code review to find secrets, broken access control, payment mistakes, dependency risks and production configuration problems.",
    image: "images/launch-ready.webp",
    imageWidth: 1200,
    imageHeight: 750,
    imageAlt: "Quick Scan First robot standing at a secure launch gateway",
    imageCaption: "A final repository review provides an evidence-based signal before release.",
    answer: "A pre-launch code review checks whether an application is safe and ready to ship. Quick Scan First focuses on repository evidence: secrets, database access, authentication, payments, dependencies and configuration, then turns each finding into a clear action or reviewable pull request.",
    sections: [
      ["What should be checked before launching a web app?", "Check secrets and environment files, authentication on every protected route, ownership checks for user data, Firebase or Supabase rules, payment amounts and webhook verification, dependency vulnerabilities, error handling, production URLs, manifests, service workers and other launch configuration."],
      ["Why repository-wide context matters", "A single file rarely tells the whole story. A route may look protected while a neighbouring API endpoint is open, or a payment button may be correct while webhook verification is missing. Quick Scan First links findings to source evidence and uses deeper review when a risk spans multiple files."],
      ["From finding to pull request", "Each report explains the risk, names the relevant file and provides a fix prompt. For supported findings, an AI-assisted fix can be created on a new branch as a pull request. The developer stays in control and can inspect the diff before merging."],
      ["What this review does not replace", "Automated review does not replace tests, monitoring, backups, legal compliance, infrastructure review or expert security testing. Use it as one repeatable part of a broader release process."],
    ],
    faqs: [
      ["When should a pre-launch scan run?", "Run it before production, after major authentication or payment changes, and before important releases."],
      ["Can it find business-logic bugs?", "The deeper review can flag likely authentication, ownership and payment logic mistakes, but all AI findings require human verification."],
      ["Does a failed operation use credits?", "No. Failed AI operations are refunded."],
    ],
    related: ["github-repository-security-scanner", "blog/github-security-checklist-before-launch", "blog/firebase-supabase-security-rules"],
  },
  {
    slug: "exposed-api-key-scanner",
    kind: "Security guide",
    title: "Exposed API key and secret scanner for GitHub repositories",
    description: "Find committed .env files, hardcoded API keys, private keys and high-risk service credentials before they reach production.",
    image: "images/secret-containment.webp",
    imageWidth: 1536,
    imageHeight: 1024,
    imageAlt: "Quick Scan First robot containing an exposed credential key in a secure chamber",
    imageCaption: "Exposed credentials should be isolated, revoked and replaced—not only deleted from code.",
    answer: "Quick Scan First checks repository files for committed environment files and patterns associated with high-risk credentials, including Stripe, OpenAI, Anthropic, AWS, GitHub, Slack, private keys and Supabase service-role keys. Any exposed secret should be revoked and rotated, not merely deleted from the latest commit.",
    sections: [
      ["What counts as an exposed secret?", "A secret is exposed when a credential that should remain private is committed to repository history, included in a public build, logged, or otherwise made available to an unauthorised person. Common examples include API keys, private keys, tokens, database passwords and privileged service credentials."],
      ["What to do when a key is exposed", "Revoke or rotate the credential with its provider first. Remove it from the application, store the replacement in a proper secret manager or deployment environment, and check logs for misuse. Removing the latest line is not enough because the value may remain in Git history and existing clones."],
      ["Preventing repeat exposures", "Keep .env files out of version control, commit a safe .env.example without values, use least-privilege credentials, add automated secret scanning to release checks, and avoid placing server-only credentials in browser code."],
      ["Limits of pattern matching", "Secret scanners can miss custom formats and can report example values as possible credentials. Treat every result as evidence to investigate, and combine automated checks with provider alerts, code review and credential rotation procedures."],
    ],
    faqs: [
      ["Does deleting a secret from GitHub make it safe?", "No. Revoke or rotate it because it can remain in Git history, caches, logs or existing clones."],
      ["Can a browser app safely contain a private API key?", "No. Anything shipped to a browser can be inspected. Calls requiring a private key should normally go through a protected server."],
      ["Does Quick Scan First store discovered keys?", "Repository code is processed for the scan and is not stored as a copy on Quick Scan First servers."],
    ],
    related: ["blog/remove-exposed-api-keys-from-github", "github-repository-security-scanner", "pre-launch-code-review"],
  },
  {
    slug: "blog/github-security-checklist-before-launch",
    kind: "Security checklist",
    title: "GitHub security checklist before launching a web app",
    description: "A practical repository security checklist for secrets, access control, database rules, dependencies, payments and production configuration.",
    image: "images/repository-security.webp",
    imageWidth: 1536,
    imageHeight: 1024,
    imageAlt: "Quick Scan First robot reviewing connected repository files before launch",
    imageCaption: "A consistent checklist turns scattered release risks into a reviewable process.",
    answer: "Before launch, verify that no secrets are committed, every protected action checks authentication and ownership, database rules deny unauthorised access, payment webhooks are verified, dependencies are reviewed, and production configuration has been tested. Record the evidence and re-run the checks after material changes.",
    sections: [
      ["1. Search for secrets and committed environment files", "Check the full repository and history for .env files, tokens, API keys, database passwords and private keys. If a real secret was committed, revoke it before cleaning the repository."],
      ["2. Test authentication and ownership", "Authentication answers who the user is; authorisation answers what that user may do. Verify both on the server for every protected read and write, including direct API requests that bypass the interface."],
      ["3. Review database security rules", "Firebase and Supabase defaults can become dangerous when broad development rules reach production. Confirm that rules are deployed, Row Level Security is enabled where required, and policies cover read, create, update and delete operations."],
      ["4. Verify payment boundaries", "Calculate prices on the server, verify webhook signatures, make processing idempotent, and never trust product IDs, amounts or account ownership supplied only by the browser."],
      ["5. Check dependencies and production setup", "Review known vulnerabilities, lockfiles, production URLs, CORS, security headers, error handling and monitoring. Test the actual built application, not only the development server."],
    ],
    faqs: [
      ["Is a checklist enough to secure an application?", "No. It creates consistency, but higher-risk products also need threat modelling, testing, monitoring and expert review."],
      ["Should checks run once or continuously?", "Run them before launch and again after changes to authentication, payments, data access, dependencies or deployment configuration."],
    ],
    related: ["github-repository-security-scanner", "blog/remove-exposed-api-keys-from-github", "blog/firebase-supabase-security-rules"],
  },
  {
    slug: "blog/remove-exposed-api-keys-from-github",
    kind: "Incident guide",
    title: "How to remove an exposed API key from GitHub safely",
    description: "The correct order for revoking, rotating, removing and investigating a secret committed to a GitHub repository.",
    image: "images/secret-containment.webp",
    imageWidth: 1536,
    imageHeight: 1024,
    imageAlt: "A glowing credential key secured inside a transparent containment chamber",
    imageCaption: "Revoke first, investigate use, then remove the secret and prevent it happening again.",
    answer: "Revoke or rotate the exposed API key immediately, investigate its use, remove it from application code, place the replacement in a protected secret store, and then clean repository history if required. Deleting the current line alone does not invalidate the credential or erase every copy.",
    sections: [
      ["1. Revoke first", "Assume a committed credential may have been copied. Use the provider dashboard or API to revoke it, then create a replacement with the minimum permissions necessary."],
      ["2. Investigate possible use", "Review provider audit logs, billing activity, authentication events and unusual traffic from the earliest possible exposure time. Preserve evidence if abuse is suspected."],
      ["3. Fix the application", "Read the replacement from a server-side environment variable or secret manager. Never expose a server credential in browser JavaScript. Add .env files to .gitignore and commit only a placeholder example."],
      ["4. Consider cleaning history", "Repository history can be rewritten to remove a secret, but rewriting affects collaborators and does not revoke copies already cloned or cached. Follow the hosting provider's current sensitive-data removal process and coordinate the change carefully."],
      ["5. Add prevention", "Add secret scanning, pre-commit checks, least-privilege credentials and a written rotation procedure. Re-scan before the next release."],
    ],
    faqs: [
      ["Is making the repository private enough?", "No. People, integrations, caches or clones may already have the credential. Rotate it."],
      ["Can I reuse the same key after deleting the commit?", "No. Use a newly issued credential and treat the old one as compromised."],
    ],
    related: ["exposed-api-key-scanner", "blog/github-security-checklist-before-launch", "pre-launch-code-review"],
  },
  {
    slug: "blog/firebase-supabase-security-rules",
    kind: "Database security",
    title: "Firebase and Supabase security rules to check before launch",
    description: "Review Firebase rules, Supabase Row Level Security and ownership policies before a web app reaches production.",
    image: "images/database-access.webp",
    imageWidth: 1536,
    imageHeight: 1024,
    imageAlt: "Quick Scan First robot guarding database towers and scanning access pathways",
    imageCaption: "Database access should be enforced at the data layer and tested from an attacker’s position.",
    answer: "Before launch, Firebase rules should deny unauthorised reads and writes, while Supabase tables exposed through the API should use Row Level Security with explicit policies. Test access as an unauthenticated user, the correct owner and a different signed-in user.",
    sections: [
      ["Avoid development rules in production", "Rules such as allowing reads and writes unconditionally are useful only in tightly controlled local work. Production rules should start from denial and grant the smallest access each operation needs."],
      ["Authentication is not ownership", "A signed-in user should not automatically access every row or document. Policies need to compare the authenticated user ID with the owner or membership recorded on the requested resource."],
      ["Check every operation", "Read, create, update and delete can require different conditions. Validate the allowed fields on writes and prevent users from changing ownership or privileged roles."],
      ["Test from the attacker's position", "Use emulators or a staging project to send direct requests without the normal interface. Test unauthenticated access, cross-account access, guessed IDs, bulk queries and attempts to write protected fields."],
      ["Protect service-role credentials", "Supabase service-role keys and server admin credentials bypass normal client protections. Keep them on trusted servers only and rotate them if they reach a repository or browser bundle."],
    ],
    faqs: [
      ["Does Supabase RLS turn on automatically?", "Do not assume it does for every table or workflow. Verify the current state and explicit policies in the project you will deploy."],
      ["Are frontend route guards enough?", "No. The database or server must enforce access because a user can bypass the interface and call an endpoint directly."],
    ],
    related: ["blog/github-security-checklist-before-launch", "github-repository-security-scanner", "pre-launch-code-review"],
  },
]);

export const productPages = pages.filter(page => !page.slug.startsWith("blog/"));

export const blogPages = pages.filter((page) => page.slug.startsWith("blog/"));

export function findPage(pathname) {
  const clean = pathname.replace(/^\/quick-scan-first\/?/, "").replace(/^\//, "").replace(/\/$/, "");
  return pages.find((page) => page.slug === clean);
}

export function pageUrl(slug = "") {
  return `${SITE_URL}/${slug ? `${slug}/` : ""}`;
}

export function shareImageFor(page) {
  const filename = page.image.split("/").at(-1).replace(/\.webp$/, "-share.jpg");
  return `images/share/${filename}`;
}
