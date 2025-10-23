# News

Dispatches from the Amp Team

[RSS](/news.rss "Subscribe to RSS feed")

1.  October 22, 2025
    
    ### [More Tools for the Agent](/news/more-tools-for-the-agent)
    
    We shipped several changes to [toolboxes](/manual#toolboxes) that make them easier to use:
    
    *   You can now have multiple toolboxes in the `AMP_TOOLBOX` environment variable
    *   `amp tools make` is a new command to create a functional example tool in the right location
    *   `amp tools show` lets you inspect a tool
    *   `amp tools use` allows you to execute it
    
    And Amp itself can fill in all the details to make the tool work as you intended.
    
    If you don't yet know what [toolboxes](/manual#toolboxes) are: a toolbox is a directory full of UNIX-style programs that provide custom tools to the agent locally. Conceptually, they sit between MCP servers and common CLI tools, but are less complex than MCP servers and easier for the agent to use than plain CLI tools.
    
    Let's use an example to see how we can use `amp tools make` and `amp tools use` to create and run a new tool in a new toolbox.
    
    Let's build a `run_tests` tool. Chances are that if you have used any coding agent before, you've probably seen it trying to run the your tests, but then stumble and having to guess a few times what the correct command invocation is. We can make (artificial) life for the agent easier by giving it a `run_tests` tool that will always use the correct command.
    
    First we create a `.amp/tools` directory in our repository and add it to the `AMP_TOOLBOX` variable, so Amp knows to look there for tools:
    
    ```bash
    # Create the directory
    mkdir -p .amp/tools
    # Add to AMP_TOOLBOX. Order matters: prefer tools in the repo over global tools
    export AMP_TOOLBOX="$PWD/.amp/tools:$HOME/.config/amp/tools"
    ```
    
    Next we run `amp tools make` to create a new tool, using a built-in template:
    
    ```bash
    amp tools make run_tests
    ```
    
    Which prints:
    
    ```
    Tool created at: /Users/dhamidi/w/amp-wip/.amp/tools/run_tests
    Inspect with: amp tools show tb__run_tests
    Execute with: amp tools use tb__run_tests
    ```
    
    Great! Now we could open `.amp/tools/run_tests` manually and edit it as needed, so it actually does what we want and runs the tests. But, hey, we can also tell Amp to inspect our `package.json` file, find the right test command, and adjust the tool template accordingly:
    
    ```bash
    amp --dangerously-allow-all -x 'Edit .amp/tools/run_tests to run the tests
    using pnpm test according to our package.json file.
    It should have an optional workspace parameter
    and an optional parameter for filtering by test name'
    ```
    
    Now we can use `amp tools show` to inspect the tool and see what Amp has created:
    
    ```
    amp tools show tb__run_tests
    ```
    
    That prints the description of the tool (which the Amp agent will see) and the schema of the input parameters (which the agent will use to run the tool):
    
    ```
    # tb__run_tests (toolbox: /Users/dhamidi/w/amp-wip/.amp/tools/run_tests)
    
    You must use this tool to run tests instead of using the Bash tool.
    This tool runs tests using pnpm test with optional workspace filtering
    and test name filtering.
    
    # Schema
    
    - workspace (string): optional workspace name to run tests in (e.g., "core", "web", "server", "cli"). If not provided, runs tests in the root workspace
    - testName (string): optional test name filter to run specific tests (passed as -t argument to vitest)
    ```
    
    But before we now have the agent try it, we can use `amp tools use` to execute the tool to make sure it works:
    
    ```
    amp tools use --only output tb__run_tests --testName "writes a tool"
    ```
    
    Note how we specified `--testName`, one of the input parameters of the tool. If we run the command, we'll see something like this:
    
    ```
    # ...
     Test Files  1 passed | 306 skipped (307)
          Tests  1 passed | 4181 skipped (4182)
    ```
    
    It works! And now, when you start Amp, it will automatically register this tool at startup, and use it to run the tests:
    
2.  October 21, 2025
    
    ### [Edit, Restore and Fork in the CLI](/news/cli-tab-navigation)
    
    You can now edit messages in the Amp CLI, restore the thread to a specific point, or fork a new thread from a message.
    
    Hit `Tab` to select a previous message, then hit `e` to edit the message, `r` to restore the thread up to and including that message, or `f` to fork the thread from that message.
    
3.  October 21, 2025
    
    ### [50% Faster Search Agent](/news/faster-search-agent)
    
    Amp's search subagent is now 50% faster. We switched the model powering the `finder` subagent to Haiku 4.5. In our evaluations and usage, this resulted in an approximate 50% speedup with no noticeable loss in quality. This means less waiting for Amp to uncover the relevant context.
    
    The search agent should be around 3X cheaper now, as well. Happy (speedy) hacking!
    
4.  October 20, 2025
    
    ### [The Librarian](/news/librarian)
    
    Amp has a new tool: the Librarian.
    
    It's a subagent built for searching remote codebases. It allows Amp to search all public code on GitHub as well as your private GitHub repositories.
    
    Tell Amp to summon the Librarian when you need to find code in multiple repositories, or, for example, when you want it to read the code of the frameworks and libraries you're using. Or when you want it to find examples of what you're trying to do in open-source code. Or when you want it to connect the dots between your code and its dependencies. Or... well, anytime you want it to find and look up code on GitHub.
    
    Here are some example prompts that lead Amp to use the Librarian:
    
    *   "Use the Librarian to lookup how React's `useEffect` cleanup function is implemented."
    *   "Explain how new versions of our documentation are deployed when we release. Search our docs and infra repositories to see how they get to X.Y.sourcegraph.com."
    *   "Ask the Librarian to explain why we're getting this error from Zod and show me the validation logic causing it."
    
    In order to use the Librarian, all you need to do is configure a GitHub connection in your [Amp settings](/settings#code-host-connections) and then tell Amp to use it.
    
    ![The Librarian at work](https://static.ampcode.com/news/librarian_5.png?version=1)
    
5.  October 15, 2025
    
    ### [Amp Free](/news/amp-free)
    
    Amp has a new mode: `free`. It's free of charge, supported by ads and the sharing of training data.
    
    Like our default mode in Amp (which is now called `smart`), [Amp Free](/free) is a unique combination of system prompt, tools, and a selection of top OSS and frontier models.
    
    Models have changed tremendously in the last six months. Many are now great at being agents, and they’re cheaper too. All this means Amp Free is now possible—plenty of good tokens at a discount, a coding agent that knows how to use them, and the Internet’s best business model: advertisements.
    
    In turn, we’re now going to make agentic programming accessible to everyone and start exploring what’s possible when good tokens become cheap.
    
    Try it: [sign in & install Amp](https://ampcode.com/manual#getting-started), then use `/mode free` in the Amp CLI, or select `free` in the prompt field in the Amp editor extension.
    
    [Read more about Amp Free »](/news/amp-free)
    
6.  October 14, 2025
    
    ### [Monthly Automatic Top Ups](/news/monthly-automatic-top-ups)
    
    You can now top up your Amp balance with a fixed amount each month, with the new monthly automatic top up option.
    
    This new mode gives you a more predictable Amp budget each month. And once you’ve used your balance you can top it up manually, or wait until your next top up date. And like always, any unused credits can be used in the following months.
    
    Head to your user or workspace settings to configure monthly automatic top ups.
    
7.  October 3, 2025
    
    ### [Amp TypeScript SDK](/news/typescript-sdk)
    
    Today we've launched the Amp TypeScript SDK. It allows you to programmatically use the Amp agent in your TypeScript programs.
    
    Here is a program, for example, that instructs the Amp agent to find and list specific files in a folder using a [custom toolbox tool](/news/toolboxes):
    
    ```typescript
    import { AmpOptions, execute } from '@sourcegraph/amp-sdk'
    import path from 'path'
    
    const prompt = `
    	What files use authentication in this directory?
    	Go through all the files and folders.
    	Use the format_file_tree tool to format results.
    	Only output the file tree.
    `
    
    const options: AmpOptions = {
    	cwd: path.join(process.cwd(), 'src'), // Run in `./src` folder
    	dangerouslyAllowAll: true, // Allow all tools, trust in Amp
    	toolbox: path.join(process.cwd(), 'toolbox'), // Location of custom toolbox
    }
    
    // execute starts the agent and streams messages
    const messages = execute({ prompt, options })
    
    for await (const message of messages) {
    	// A system message contains information about the current session
    	if (message.type === 'system') {
    		console.log(`Started thread: ${message.session_id}`)
    
    		// For example, the custom tools that were found in the toolbox
    		console.log(
    			'Available tools in Toolbox: ',
    			message.tools.filter((tool) => tool.startsWith('tb__')).join(', '),
    		)
    	} else if (message.type === 'assistant') {
    		// An assistant message contains the assistants text replies
    		// or tool uses
    		console.log('Assistant:', message)
    	} else if (message.type === 'result') {
    		// A result message contains the last message of the assistant
    		console.log('Files using authentication:', message.result)
    	}
    }
    ```
    
    You only need to install one package to get started:
    
    ```shell-session
    $ npm install @sourcegraph/amp-sdk
    ```
    
    Since you can invoke Amp in any TypeScript program, there are very few limits to what you can build. Here are some ideas and examples of things we've built internally:
    
    *   **Code Review Agent**: Automated pull request analysis and feedback
    *   **Documentation Generator**: Create and maintain project documentation
    *   **Test Automation**: Generate and execute test suites
    *   **Migration Assistant**: Help upgrade codebases and refactor legacy code
    *   **CI/CD Integration**: Smart build and deployment pipelines
    *   **Issue Triage**: Automatically categorize and prioritize bug reports
    
    To get more ideas and familiar with the SDK, take a look at the examples in the [manual](https://ampcode.com/manual/sdk#advanced-usage).
    
8.  October 1, 2025
    
    ### [GPT-5 Oracle](/news/gpt-5-oracle)
    
    The [`--try-gpt5` experiment](/news/gpt-5) is over. GPT-5 is here to stay as the new model for [the oracle](/manual#oracle), replacing o3, but no longer as an experimental primary model in Amp.
    
    We found GPT-5 to be surprisingly good in certain contexts, when planning or debugging, for example, which makes it a great model to take on the role of the oracle. But it's also less proactive, less likely to jump over that last hurdle, compared to Sonnet, and these are qualities we look for in the main agent model. Then again, its reasoning capabilities, its different training lineage, and the absence of certain idiosyncracies make it a great partner for Sonnet.
    
    Now GPT-5 is the oracle in Amp. That means you can summon it at any point in an Amp thread to help with complex plans and bugs:
    
    *   "Look at the DB query calls and ask the oracle to provide a plan for how to refactor that reduces code duplication"
    *   "Use the oracle to figure out when `createSupervisor` threads can throw an uncaught error based on the debug log output in `@log.txt`"
    *   "I don't like that architecture. Use the oracle to analyze the callers and design a better architecture with clearer separation of concerns and pluggable storage."
    *   "Ask the oracle to review the code we just wrote"
    
    (You can find [more examples](/manual#oracle) in the manual.)
    
    Thanks to everybody for testing and evaluating GPT-5 and sharing their experiences with us!
    
    We're still tweaking system prompts, still exploring new mechanics of how to interact with agents, and still thinking about where else we could fit GPT-5 into Amp. Because it is a fascinating model and there has to be a way to get even more out of it.
    
9.  September 30, 2025
    
    ### [Amp CLI connects to VS Code and Neovim](/news/cli-vscode-neovim)
    
    You can now connect the [Amp CLI](https://ampcode.com/manual#getting-started-command-line-interface) to VS Code and Neovim.
    
    This allows Amp to access your current file, selected text, and diagnostics. It also enables Amp to edit files directly through your IDE.
    
    All that's required is the latest version of the Amp CLI, and either the [Neovim plugin](https://github.com/sourcegraph/amp.nvim) or the [Amp VS Code extension](https://marketplace.visualstudio.com/items?itemName=sourcegraph.amp). Then you can run `amp --ide` from your project root and the CLI will connect to the IDE in the current workspace.
    
    Here, for example, is the Amp CLI connected to Neovim:
    
    And here is the Amp CLI connected to VS Code:
    
    Learn more about the new integration in the [manual](https://ampcode.com/manual#ide).
    
10.  September 29, 2025
     
     ### [Now Using Claude Sonnet 4.5](/news/claude-sonnet-4-5)
     
     We've switched Amp's primary model to [Claude Sonnet 4.5](https://www.anthropic.com/news/claude-sonnet-4-5), the latest release from Anthropic.
     
     In our testing of Sonnet 4.5 in Amp, we found noticeable improvements for coding, including:
     
     *   Reduced sycophancy
     *   Higher success rates for file edits
     *   Improved reasoning during complex tasks like debugging
     
     The switch is automatic. Update to the latest release of Amp's VS Code extension or CLI to start using Claude Sonnet 4.5.
     
11.  September 23, 2025
     
     ### [Amp Tab for All](/news/amp-tab-for-all)
     
     Amp Tab is our free in-editor completion engine for when you need to edit code manually in VS Code, Windsurf and Cursor. It's fast (really fast), understands diagnostic errors, and can suggest updates across multiple files. And we've just turned it on by default for all new Amp extension installs.
     
     If you’ve already installed the Amp extension, you can run “Enable Amp Tab” from the command palette (Cmd+Shift+P on macOS, Ctrl+Shift+P on Windows/Linux) to get started.
     
     Fast accurate edits:
     
     Resolve errors introduced by recent changes:
     
     Make changes across multiple files:
     
12.  September 23, 2025
     
     ### [Globs in AGENTS.md](/news/globs-in-AGENTS.md)
     
     Your [`AGENTS.md` files](/manual#AGENTS.md) can now include other context files dynamically, with glob mentions and filters, so you can give more granular guidance to the agent.
     
     For example, to apply language-specific coding rules:
     
     1.  Put `See @docs/*.md` anywhere in your `AGENTS.md` file.
         
     2.  Create a file `docs/typescript-conventions.md` with:
         
         ```markdown
         ---
         globs:
           - '**/*.ts'
         ---
         
         Follow these TypeScript conventions:
         
         - Never use the `any` type
         - ...
         ```
         
     3.  Repeat for other languages.
         
     
     There's nothing special about `@docs/*.md`; you could instead mention `@.agent/rules/*.md` or `@.cursor/rules/*.mdc` or anywhere else you want these rules to live.
     
     These @-mentioned files with `globs` will only be included if Amp has read a file matching any of the globs (in the example above, any TypeScript file). Use `/agent-files` (CLI) or hover over `X% of 968k` (editor extension) to see the guidance files in use.
     
13.  September 9, 2025
     
     ### [Streaming JSON](/news/streaming-json)
     
     The Amp CLI has two new flags: `--stream-json` and `--stream-json-input`.
     
     They can be used together with the `--execute` flag to turn on structured JSON output and input, respectively.
     
     Here is an example:
     
     ```shell-session
     $ amp --execute "what is 2+2?" --stream-json
     ```
     
     This would print something like the following on stdout:
     
     ```
     {"type":"system","subtype":"init","cwd":"/Users/mrnugget/work/amp","session_id":"T-2775dc92-90ed-4f85-8b73-8f9766029e83","tools":["oracle","..."],"mcp_servers":[]}
     {"type":"user","message":{"role":"user","content":[{"type":"text","text":"what is 2+2?"}]},"parent_tool_use_id":null,"session_id":"T-2775dc92-90ed-4f85-8b73-8f9766029e83"}
     {"type":"assistant","message":{"type":"message","role":"assistant","content":[{"type":"text","text":"2 + 2 equals 4."}],"stop_reason":"end_turn","usage":{"input_tokens":12783,"cache_creation_input_tokens":367,"cache_read_input_tokens":12416,"output_tokens":8,"max_tokens":224000,"service_tier":"standard"}},"parent_tool_use_id":null,"session_id":"T-2775dc92-90ed-4f85-8b73-8f9766029e83"}
     {"type":"result","subtype":"success","duration_ms":2906,"is_error":false,"num_turns":1,"result":"2 + 2 equals 4.","session_id":"T-2775dc92-90ed-4f85-8b73-8f9766029e83"}
     ```
     
     Structured input can be provided on stdin with the `--stream-json-input` flag:
     
     ```shell-session
     $ echo '{
       "type": "user",
       "message": {
         "role": "user",
         "content": [
           {
             "type": "text",
             "text": "what is 2+2?"
           }
         ]
       }
     }' | amp -x --stream-json --stream-json-input
     ```
     
     If `--stream-json-input` is set, the Amp CLI will process user messages as soon as they are received on stdin and exit as soon as stdin is closed and the agent has ended its turns.
     
     Combined with `amp threads continue [thread id]`, multi-turn conversations can even happen across multiple invocations of the CLI:
     
     ```shell-session
     $ amp -x "what is 2+2?" --stream-json
     ...
     $ amp threads continue -x "and now add 7 to that" --stream-json
     ...
     {"type":"result","result":"11.", "subtype":"success","duration_ms":2906,"is_error":false,"num_turns":2,"session_id":"T-2775dc92-90ed-4f85-8b73-8f9766029e83"}
     ```
     
     See the [Manual](https://ampcode.com/manual#cli-streaming-json) for more details and the [Appendix](/manual/appendix#stream-json-output) for the full schema.
     
14.  September 2, 2025
     
     ### [Look ma, no flicker](/news/look-ma-no-flicker)
     
     Today the Amp CLI reached the next stage in its evolution.
     
     It’s no longer just a command-line tool, but a proper terminal user interface — fullscreen, responsive, fast, and built on our own framework.
     
     Our framework now lets us do things that were previously awkward or impossible: smooth scrolling while tool calls stream in, real mouse interactions with the transcript and the rest of the interface, overlays, popups, and clickable buttons.
     
     But maybe most importantly: no flicker. No jarring redraws. No stuttering text.
     
     And without flicker, really, anything’s possible.
     
15.  August 29, 2025
     
     ### [Bring Your Own Tools](/news/toolboxes)
     
     You can now provide tools to Amp in the form of executable files.
     
     If the environment variable `AMP_TOOLBOX` is set and contains the path to a directory, Amp will look in that directory for executables to be used as tools.
     
     On start, Amp will invoke each executable it found, with the environment variable `TOOLBOX_ACTION` set to `describe`. The tool is then expected to write its description (which is what will end up in the system prompt that's sent to the agent) to `stdout`.
     
     Here is an example:
     
     ```javascript
     #!/usr/bin/env bun
     import fs from 'node:fs'
     const action = process.env.TOOLBOX_ACTION
     
     if (action === 'describe') showDescription()
     else if (action === 'execute') runTests()
     
     function showDescription() {
     	process.stdout.write(
     		JSON.stringify({
     			name: 'run-tests',
     			description: 'use this tool instead of Bash to run tests in a workspace',
     			args: { dir: ['string', 'the workspace directory'] },
     		}),
     	)
     }
     ```
     
     When the agent then decides to invoke your tool, Amp runs the executable again, this time setting `TOOLBOX_ACTION` to `execute`. Amp passes the tool call arguments on `stdin` and the executable can then execute the tool call:
     
     ```javascript
     function runTests() {
     	let dir = JSON.parse(fs.readFileSync(0, 'utf-8'))['dir']
     	dir = dir && dir.length > 0 ? dir : '.'
     	Bun.spawn(['pnpm', '-C', dir, 'run', 'test', '--no-color', '--run'], {
     		stdio: ['inherit', 'inherit', 'inherit'],
     	})
     }
     ```
     
     You can read more about toolboxes and possible input and output formats [in the manual](/manual#toolboxes).
     
16.  August 27, 2025
     
     ### [1,000,000 Tokens](/news/1m-tokens)
     
     Amp can now use [1 million tokens of context](https://docs.anthropic.com/en/docs/build-with-claude/context-windows#1m-token-context-window) with Claude Sonnet 4, up from [432,000 tokens](https://ampcode.com/news/432k-tokens) two weeks ago.
     
     You should not use the full context window for most tasks in Amp. Instead, use [small threads](/how-i-use-amp#small-threads) that are scoped to a single task. Amp is better, faster, and cheaper when used this way. A notice will appear when you hit 20% of the context window to remind you of this.
     
     Longer threads are more expensive, both because each iteration of the agentic loop sends more and more tokens, and because requests with more than 200k tokens are roughly [twice as expensive](https://docs.anthropic.com/en/docs/about-claude/pricing#long-context-pricing) per token in Anthropic's API pricing.
     
     ![Amp thread with 1,000,000 tokens of context](https://static.ampcode.com/news/1m-context.png)
     
     _Note: the screenshot shows 968k tokens because the context window is composed of 968k input tokens and 32k output tokens._
     
17.  August 25, 2025
     
     ### [Custom Slash Commands](/news/custom-slash-commands)
     
     You can now define custom slash commands in the Amp CLI. They allow you to insert pre-defined or dynamically-generated text into the prompt input.
     
     To define a custom slash command, create a file at the root of your repository in a `.agents/commands/` folder. The name of the file serves as the name of the slash command.
     
     For example, if you create `.agents/commands/pr-review.md` it will create the `/pr-review` slash command. When you use the command, the contents of the `pr-review.md` file will be inserted into the prompt input.
     
     Alongside this, we're also shipping an experimental mode for _executable_ slash commands: if a text file in `.agents/commands` is executable and has a `#!` on its first line (as in `#!/usr/bin/env bash`, for example), it will also get turned into a slash command. And when that command is then invoked, the corresponding file is executed and its output will be inserted.
     
18.  August 25, 2025
     
     ### [Enterprise Managed Settings](/news/enterprise-managed-settings)
     
     Amp now allows system administrators to configure organization-wide settings that override individual settings for Enterprise Amp customers. These settings can help ensure security, standardization, and best practices across an organization. Managed settings can be used, for example, to do the following:
     
     *   Set MCP servers to those that work well in your organization (`amp.mcpServers`)
     *   Allow or block MCP servers (`amp.mcpPermissions`)
     *   Allow or block Bash commands that match specified patterns (`amp.permissions`)
     *   Override any other Amp setting
     
     To use managed settings, system administrators should ensure the settings are defined in the following files:
     
     *   **macOS**: `/Library/Application Support/ampcode/managed-settings.json`
     *   **Linux**: `/etc/ampcode/managed-settings.json`
     *   **Windows**: `C:\ProgramData\ampcode\managed-settings.json`
     
     Settings in these files use the same schema as individual settings.
     
     You can read more about managed settings [in the manual.](/manual?internal#enterprise-managed-policy-settings)
     
19.  August 25, 2025
     
     ### [MCP Permissions](/news/mcp-permissions)
     
     The setting `amp.mcpPermissions` defines rules that block or allow MCP servers.
     
     MCP permissions are evaluated using a rule-based system with the same pattern matching syntax that is used for [tool permissions](/manual#permissions). The first matching rule determines the action. If no rules match, the MCP server is allowed by default.
     
     The following configuration would block all MCP servers except locally-executed servers from the `@modelcontextprotocol` npm organization and remote servers from `trusted-service.com`:
     
     ```json
     {
     	"amp.mcpPermissions": [
     		{
     			"matches": { "command": "npx @modelcontextprotocol/server-*" },
     			"action": "allow"
     		},
     		{
     			"matches": { "url": "https://trusted-service.com/mcp/*" },
     			"action": "allow"
     		},
     		{
     			"matches": { "url": "*" },
     			"action": "reject"
     		}
     		{
     			"matches": { "command": "*" },
     			"action": "reject"
     		}
     	]
     }
     ```
     
     Read more about `amp.mcpPermissions` in [the manual.](/manual?internal#core-settings)
     
20.  August 21, 2025
     
     ### [JetBrains Diagnostics for Java, Kotlin, and Scala](/news/jetbrains-diagnostics)
     
     Amp CLI can now read diagnostics from JetBrains IDEs for JVM languages such as Java, Kotlin, and Scala.
     
     See the [Manual](https://ampcode.com/manual) for how to connect Amp CLI to your JetBrains IDE.
     
21.  August 21, 2025
     
     ### [Multi-File Tab](/news/multi-file-tab)
     
     Amp Tab will now suggest edits across multiple recently-viewed files when an accepted edit introduces diagnostic errors.
     
     Press `Tab` once to preview the file, and `Tab` again to make the jump.
     
22.  August 21, 2025
     
     ### [Through the Agent, Into the Shell](/news/through-the-agent-into-the-shell)
     
     Finally: the Amp CLI now also lets you execute shell commands, right there in the prompt input.
     
     It's called shell mode. You activate it by starting a message with `$`. Everything you type after that will be executed as a shell command. The command and its output will be included in the context window the next time you send a message to the agent.
     
     It's a good way to show the agent the output of a command without the agent having to execute it.
     
     Type `$$` and you'll activate the incognito version of shell mode in which the commands are executed in the same way, but not included in the context.
     
     That, in turn, is handy when you want to run noisy commands to check on something, or fire off a quick command that you'd otherwise run in a separate terminal.
     
23.  August 20, 2025
     
     ### [From AGENT.md to AGENTS.md](/news/AGENTS.md)
     
     In [May we added support for `AGENT.md` files](https://ampcode.com/news/AGENT.md) to Amp. Not long after, [OpenAI picked `AGENTS.md` (plural) for their agent](https://x.com/sqs/status/1923793682966438303) and, instead of insisting on what we came up with, we decided that we'd prefer one standard.
     
     Our condition: if OpenAI can get the [agents.md](https://agents.md) domain, we'll switch. And that condition has now been met.
     
     True to our word, and as of today, Amp will look for `AGENTS.md` files (while staying backwards compatible with existing `AGENT.md` files, of course)
     
     ![AGENTS.md standard](/news/agents-md-standard.png)
     
24.  August 20, 2025
     
     ### [A New Model for Amp Tab](/news/new-model-for-amp-tab)
     
     Amp Tab now uses an updated custom model to provide better completions.
     
     In order to train this model, we rebuilt our training dataset to include synthetically generated examples to improve the model's performance in specific scenarios in which the previous model produced poor or missing suggestions, such as follow-up edits.
     
     The new model also uses DPO (Direct Preference Optimization) post-training on top of our SFT (Supervised Fine-Tuning) base. To do that, we used the model's previous bad outputs as negative examples alongside the new synthetic ground truth as positive examples, teaching it to avoid common failure patterns.
     
     Here, see how follow-up edits work much better now. In this video, deleting a proxy variable triggers a chain of completions, including fixes to the constructor and updates to the header.
     
25.  August 19, 2025
     
     ### [New Threads without Leaving the CLI](/news/new-threads-without-leaving-the-cli)
     
     You can now start new threads and continue old threads without leaving your CLI session. Use `/new` for a new thread and `/continue` to pick an old thread.
     
26.  August 18, 2025
     
     ### [Queue Messages in the CLI](/news/queue-messages-in-the-cli)
     
     You can now also [queue messages](/manual#queueing-messages) in the CLI. Once queued, messages will be sent to the agent once it's done with its current turn.
     
     Use `/queue <message>` to enqueue a message and `/dequeue` to dequeue them.
     
27.  August 13, 2025
     
     ### [432,000 Tokens](/news/432k-tokens)
     
     Amp can now use 432,000 tokens of context with [Claude Sonnet 4](https://docs.anthropic.com/en/docs/build-with-claude/context-windows#1m-token-context-window), more than 2x the previous limit imposed by the model. Your threads can keep going for longer, with more iterations, more context, more replies, and larger files, before you need to compact or start a new thread.
     
     We've rolled it out to all Amp users in the [latest CLI and editor extension](/manual#getting-started). We'll ship support for 1 million tokens of context soon.
     
     You should still start new threads for new tasks and use [small threads](/how-i-use-amp#small-threads) where possible.
     
     ![Amp thread with 432,000 tokens of context](https://static.ampcode.com/news/1m-tokens-2.png)
     
28.  August 13, 2025
     
     ### [Diagnostic-Driven Completions](/news/diagnostic-driven-completions)
     
     Amp Tab now uses language server diagnostics to suggest follow-up edits that resolve errors introduced by previous edits.
     
     This means you can get completions across the entire file, not just in nearby code.
     
     It's particularly useful when making changes that immediately introduce fixable errors, such as changing the signature of a function or renaming a variable.
     
29.  August 12, 2025
     
     ### [Model Evaluation](/news/model-evaluation)
     
     A lot of models have been released in the last few weeks: Kimi K2, Qwen3-Coder, GLM-4.5, gpt-oss, Claude Opus 4.1, GPT-5, diffusion models, and there's no end in sight.
     
     We've been trying a lot of them, to see whether they can make Amp better.
     
     In Amp, a new model isn't just another entry in a model selection dropdown menu. It's part of a whole in which many different models have different jobs to do and for each job we want to use the best model, regardless of cost or deployment concerns. So when a new model comes along, we ask:
     
     *   Is it a frontier model that can replace Claude Sonnet 4 fully or even partially as the main agent model?
     *   Is it a good [subagent](/manual#subagents) model that spikes in certain areas? (Like how [the oracle](/manual#oracle) uses a different model, originally o3.)
     *   Is it a fast utility model that we can use, for example, for search, summarization, or other similar tasks?
     
     With this post, we want to show you a week in the life of the Amp team as we evaluate new models. Impressions, ideas, tips — we'll share what we discover.
     
     We'll continuously update it with notes from [Thorsten](https://x.com/thorstenball), [Camden](https://github.com/camdencheek), [Quinn](https://x.com/sqs), [Beyang](https://x.com/beyang), and other Amp team members.
     
     *   [GPT-5 One Week Later](/news/model-evaluation#gpt5-one-week-later) _(latest note)_
     *   [GPT-5 is pretty good after a few days of use](/news/model-evaluation#gpt5-pretty-good)
     *   [GPT-5, Two First Impressions](/news/model-evaluation#gpt5-two-first-impressions)
     *   [Elbow Grease](/news/model-evaluation#gpt5-elbow-grease)
     *   [Try GPT-5](/news/model-evaluation#gpt5)
     *   [Try Claude Opus 4.1](/news/model-evaluation#opus)
     *   [Good Forward-Looking Evals](/news/model-evaluation#forward-looking-evals)
     
     _Last updated: 2mo ago_
     
     [See latest notes »](/news/model-evaluation)
     
30.  August 7, 2025
     
     ### [Try GPT-5 with us](/news/gpt-5)
     
     We're in the process of [evaluating where and how GPT-5 might fit into Amp](/news/model-evaluation#gpt5).
     
     You can join us and try GPT-5 in Amp now:
     
     *   **CLI**: `amp --try-gpt5`
     *   **Editor extension**: Set `"amp.gpt5": true` in VS Code, Cursor, Windsurf (or other VS Code fork) settings
     
     (This flag and setting will only exist for a limited time, until we've made a call on how to use GPT-5.)
     
31.  August 7, 2025
     
     ### [JetBrains in the CLI](/news/jetbrains-in-the-cli)
     
     You can now connect the [Amp CLI](https://ampcode.com/manual#getting-started-command-line-interface) to JetBrains IDEs.
     
     This provides Amp with context about your current file and selection. It also allows Amp to edit files directly through the IDE.
     
     [Update the Amp CLI](https://ampcode.com/manual#getting-started-command-line-interface) to the latest version and run `amp --jetbrains` from the root of your project.
     
     Learn more about the new JetBrains integration [in the manual.](/manual#jetbrains)
     
32.  August 7, 2025
     
     ### [Tool-Level Permissions](/news/tool-level-permissions)
     
     Instead of only allowing you to configure which Bash commands are allowed to run and which aren't, Amp now gives you the ability to define which tool it's allowed to run, and with which arguments.
     
     When Amp wants to call a tool, it first checks your list of permissions to find an entry that matches the tool and the tool call arguments. The matched entry then tells Amp to either _allow_ the tool call, _reject_ it, _ask_ you for confirmation, or _delegate_ the decision to another program. If no matching entry is found, Amp checks the built-in permission list that contains sensible defaults.
     
     You can define these granular tool-level permissions by adding entries to the `amp.permissions` list in your [configuration file](/manual#permissions). Here's an example:
     
     ```json
     "amp.permissions": [
       // Ask before running a command containing "git commit"
       { "tool": "Bash", "matches": { "cmd": "*git commit*" }, "action": "ask"},
       // Reject command containing "python " or "python3 "
       { "tool": "Bash", "matches": { "cmd": ["*python *", "*python3 *"] }, "action": "reject"},
       // Ask before running any MCP tool
       { "tool": "mcp__*", "action": "ask"},
       // Delegate everything else to a permission helper (must be on $PATH)
       { "tool": "*", "action": "delegate", "to": "my-permission-helper"}
     ]
     ```
     
     You can read more about the new tool-level permissions [in the manual](/manual#permissions).
     
33.  July 30, 2025
     
     ### [Amp Tab 30% Faster](/news/amp-tab-30-percent-faster)
     
     Response times of [Amp Tab](/manual#amp-tab), our in-editor completion engine, are now 30% faster, with up to 50% improvements during peak usage.
     
     We worked together with [Baseten](https://www.baseten.co/) to optimize our custom deployment. The new infrastructure delivers roughly 2x performance improvements by switching to TensorRT-LLM as the inference engine and implementing KV caching with speculative decoding.
     
     This new infrastructure also includes a modified version of lookahead decoding that uses an improved n-gram candidate selection algorithm and variable-length speculations, which reduces both draft tokens and compute per iteration compared to standard implementations.
     
     ![Chart showing Amp Tab latency improvements over time](https://static.ampcode.com/news/next-cursor-latency-trend-dark.png)
     
34.  July 29, 2025
     
     ### [Thread Forking in VS Code](/news/thread-forking)
     
     Click on _Fork_ to create a new thread containing all messages prior to this point. Forked threads have a backlink to the original thread.
     
     You can use it to take the same thread into different directions. For example, to explore alternative implementations or asking questions while you wait for the current task to finish.
     
35.  July 24, 2025
     
     ### [amp dash x](/news/amp-x)
     
     The [Amp CLI](/manual#getting-started-command-line-interface) has a new flag: `--execute`.
     
     `-x` for short.
     
     That flag turns on execute mode, which allows for programmatic use of the Amp CLI.
     
     The CLI sends the given prompt to the agent and waits until the agent is done. Then it prints the agent's last message.
     
     ```shell-session
     $ amp -x "Give me a list of targets in this Makefile. Only the names."
     git
     zsh
     ghostty
     atuin
     jj
     all
     ```
     
     ```shell-session
     $ amp -x "Rename all .markdown files to .md then print the new names."
     - readme.markdown → readme.md
     - ghostty.markdown → ghostty.md
     ```
     
     You can also pipe input to it:
     
     ```shell-session
     $ echo "what package manager do we use here? reply only with name." | amp -x
     pnpm
     ```
     
     Execute mode is automatically turned on when you redirect stdout:
     
     ```shell-session
     $ echo "list all markdown files in here" | amp > output.txt
     $ cat output.txt
     README.md
     CONTRIBUTING.md
     YOURE_ABSOLUTELY_RIGHT.md
     ```
     
     You can also use execute mode with `threads continue`:
     
     ```shell-session
     $ amp -x "what is 2+2?"
     4
     
     $ amp threads continue -x "add 5 to that"
     9
     
     $ amp threads continue -x "now minus 3"
     6
     ```
     
36.  July 23, 2025
     
     ### [Towards a new CLI](/news/towards-a-new-cli)
     
     Everything is changing and everything has changed, even in something that's decades old: the terminal.
     
     Mere months ago, running agents in your terminal was considered a curiosity.
     
     Now it's something we all do. Some of us casually; others many, many, _many_ times a day — in multiple windows, multiple split panes, multiple checkouts of repositories.
     
     Today we released a new version of our [Amp CLI](/manual#getting-started-command-line-interface).
     
     It's our first step into a future of which we don't know much, but this: agents in the terminal are part of it — and we are building a CLI to unleash them.
     
     You can use it right now:
     
     ```bash
     $ npm install -g @sourcegraph/amp
     
     $ amp login
     
     $ amp
     ```
     
     ![Four instances of the Amp CLI in action](https://static.ampcode.com/news/towards-new-cli-quad.png)
     
37.  July 8, 2025
     
     ### [Streamable Transport for MCP](/news/streamable-mcp)
     
     Amp now uses [streamable HTTP transport](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#streamable-http) for MCP servers by default with a fallback to Server-Sent Events.
     
     That allows you to connect to your own MCP servers hosted on [Cloudflare](https://blog.cloudflare.com/streamable-http-mcp-servers-python/) or use other remote servers such as `https://learn.microsoft.com/api/mcp`.
     
     ![Streamable HTTP transport in action](https://static.ampcode.com/news/streamable-mcp.png)
     
38.  July 7, 2025
     
     ### [Multiple AGENT.md Files](/news/multiple-AGENT.md-files)
     
     _Update: Amp now looks in files named `AGENTS.md` (with an `S`)._
     
     Amp now looks for `AGENT.md` files in subtrees, parent directories, and `~/.config/AGENT.md`.
     
     This lets you keep your top-level `AGENT.md` general and create more specific `AGENT.md` files in subtrees. They'll be included only when Amp works in that subtree.
     
     You can also @-mention files in `AGENT.md` to include additional context.
     
     [Manual »](/manual#AGENTS.md)
     
     ![Multiple AGENT.md files in use](https://static.ampcode.com/news/multiple-agent-md-files-2.png)
     
39.  July 4, 2025
     
     ### [Oracle](/news/oracle)
     
     There's something new in Amp's toolbox: a tool called `oracle`. Behind that tool is a read-only subagent powered by one of the most powerful models today: OpenAI's o3.
     
     o3 is slightly slower than the model behind Amp's main agent, Sonnet 4. It's also slightly more expensive and less suited for day-to-day agentic coding. But it is impressively good at reviewing, at debugging, at analyzing, at figuring out what to do next.
     
     That's why we made it available as a tool, so the main agent and the oracle can work together — hand in hand, or, well, the agentic equivalent: token by token, one writing code, the other analyzing and reviewing.
     
     We consciously haven't pushed the oracle too hard in the system prompt, to avoid unnecessarily increasing costs for you or slowing you down. Instead, we rely on explicit prompting to get the main agent to consult the oracle.
     
     Here are some prompts we used:
     
     *   "Use the oracle to review the last commit's changes. I want to make sure that the actual logic for when an idle or requires-user-input notification sound plays has not changed."
     *   "Analyze how the functions `foobar` and `barfoo` are used. Then I want you to work a lot with the oracle to figure out how we can refactor the duplication between them while keeping changes backwards compatible."
     *   "I have a bug in these files: ... It shows up when I run this command: ... Help me fix this bug. Use the oracle as much as possible, since it's smart."
     
     ![Oracle in action](https://static.ampcode.com/news/oracle.png)
     
40.  June 27, 2025
     
     ### [Better, Faster, Cheaper Summaries](/news/better-faster-cheaper-summaries)
     
     Amp now uses a different model when compacting or summarizing threads.
     
     It's 4-6x faster, roughly 30x cheaper, and provides better summaries when you either compact a thread or create a new thread with a summary.
     
41.  June 26, 2025
     
     ### [Queued Messages](/news/queued-messages)
     
     You can now queue messages that will only be sent to the agent once it's idle. To add a message to the queue, hold shift while submitting.
     
42.  June 10, 2025
     
     ### [Agents for the Agent](/agents-for-the-agent)
     
     Amp now has subagents. Thorsten [wrote a post](/agents-for-the-agent) about subagents, what they even are, and how they make us wonder whether everything is changing again.
     
43.  June 6, 2025
     
     ### [Amp Tab](/news/amp-tab)
     
     Today, we're launching Amp Tab, our new in-editor completion engine, designed to anticipate your next actions and reduce the time spent manually writing code.
     
     It uses a custom model that was trained to understand what you are trying to do next, based on your recent changes, your language server's diagnostics, and what we call semantic context.
     
     Amp Tab can suggest regular single or multi-line edits to change entire code blocks, next to your cursor or farther away, somewhere else in your current document.
     
     We're releasing Amp Tab now as a research preview, free to use for all Amp users. Enable it by adding the following to your VS Code settings:
     
     ```json
     {
     	"amp.tab.enabled": true
     }
     ```
     
44.  June 2, 2025
     
     ### [Multi-Root Workspaces](/news/multi-root-workspaces)
     
     Amp now has improved support for multi-root workspaces:
     
     *   Reading, editing, and reverting file changes now works consistently across different workspace roots
     *   The name of the workspace root is now shown alongside file paths in the UI
     *   The search agent now covers all workspace roots
     
     ![Multi-root workspaces](https://static.ampcode.com/news/multiroot-workspaces.png)
     
45.  May 30, 2025
     
     ### [Secret Redaction](/news/secret-redaction)
     
     Amp now identifies secrets and redacts them with markers like `[REDACTED:aws-access-key-id]`, so they are not exposed to the LLM, other tools, or ampcode.com. See [Amp Security Reference](/security#secret-redaction) for details.
     
46.  May 29, 2025
     
     ### [Raising an Agent, Episode 6](/podcast)
     
     Quinn and Thorsten discuss Claude 4, sub-agents, background agents, and they share "hot tips" for agentic coding.
     
47.  May 28, 2025
     
     ### [Terminal Improvements](/news/terminal)
     
     We have made multiple changes to how we run terminal commands in Amp:
     
     **Environment** — Commands now run by default in the integrated VS Code terminal inheriting your shell environment including Python virtual environments and direnv configuration.
     
     **Interactivity** — Use the new "View in Terminal" button to interact with commands that require stdin, or the new "Detach" button to let the command continue running in the background.
     
     **Output** — Progress bars with ANSI escape codes now render beautifully in the UI without eating up your context window, only the final output is presented to the model.
     
48.  May 28, 2025
     
     ### [TODOs for the Agent](/news/todos)
     
     The TODO feature that lets the agent manage its own list of tasks is now enabled by default.
     
49.  May 22, 2025
     
     ### [Image Support in CLI](/news/cli-image-support)
     
     You can now refer to image files in the [Amp CLI](https://www.npmjs.com/package/@sourcegraph/amp). Paste the file path, drag a file into the terminal, or use file mentions by pressing @ to fuzzy-find the file. Images are useful for prompting with screenshots, designs, and more.
     
50.  May 22, 2025
     
     ### [Amp Now Uses Claude Sonnet 4](/news/default-claude-sonnet-4)
     
     We've been using and tuning Amp with [Claude 4](https://www.anthropic.com/news/claude-4) internally for weeks. Now that Anthropic has released it, we've switched Amp's primary model to be Claude Sonnet 4.
     
     Amp is already designed to get the most power out of Claude 4. In our testing, we've found this new model to be:
     
     *   Faster
     *   More stable, less easily distracted
     *   Smarter at tool calling
     *   More willing to invoke tools in parallel
     *   Better at recovering from errors
     *   Generally more trustworthy
     
     To start using Claude 4 in Amp, update to the latest release of Amp's VS Code extension or CLI. No settings changes are needed; see [why we don't make the user switch models](/fif#model-selector).
     
51.  May 20, 2025
     
     ### [The First 500,000 Messages](/news/500k)
     
     Last week we opened up Amp to the world, and now it's about to hit 500,000 messages sent.
     
     We've been busy fixing bugs and making the whole experience of using Amp as smooth, solid, and fast as possible.
     
     Please keep the feedback coming, on [Discord](https://discord.gg/YgbjkYMPnz), on X ([1](https://x.com/glenmaddern/status/1923035621737554157) [2](https://x.com/MattHalv33/status/1923130025508753830) [3](https://x.com/ianlyyons/status/1922999152281092539) [4](https://x.com/snipeship/status/1922968406929690797) [5](https://x.com/Sherveen/status/1922999402920137184) [6](https://x.com/jonaylor89/status/1923783067048509803) [7](https://x.com/CogArchitect/status/1923375827405664344) [8](https://x.com/LrsEckrt/status/1923346632675922218) [9](https://x.com/devgerred/status/1923916531982823808) [10](https://x.com/__tosh/status/1924142934028402838) [11](https://x.com/westonjossey/status/1924233388929790066) [12](https://x.com/____hnsn/status/1924609485508956231) [13](https://x.com/ditorodev/status/1924732866220453927) [14](https://x.com/ivanleomk/status/1925079910483468330) [15](https://x.com/louissmit_/status/1925101954327327201) …), or to [amp-devs@sourcegraph.com](mailto:amp-devs@sourcegraph.com).
     
     Thank you and happy coding!
     
52.  May 15, 2025
     
     ### [Amp Is Now Available To Everyone — Here's How I Use It](/how-i-use-amp)
     
     As of today, Amp is available to everyone. No more waitlist.
     
     Thorsten used the occasion of Amp now being available to everyone to write down how he uses it and how it changed programming for him.
     
53.  May 14, 2025
     
     ### [Raising an Agent, Episode 5](/podcast)
     
     Beyang interviews Thorsten and Quinn to unpack what has happened in the world of Amp in the last five weeks: how predictions played out, how working with agents shaped coding practices, and the evolution of AI coding tools from browser automation to model training.
     
54.  May 9, 2025
     
     ### [History in CLI](/news/cli-history)
     
     You can now navigate the local history of messages in the [Amp CLI](https://www.npmjs.com/package/@sourcegraph/amp). Use the arrow keys or Ctrl+P/Ctrl+N to navigate the adjacent messages in the history. PageUp and PageDown jumps directly, regardless of cursor position. Your current draft is available at the end of the history, and you can press Ctrl+C or Esc to cancel and go back to your draft.
     
55.  May 8, 2025
     
     ### [No More BYOK](/news/no-more-byok)
     
     We removed Isolated Mode, which let you use Amp with your own API keys for LLM inference, because it's not possible for it to meet our quality bar. The intent was to make it easier to use Amp in locked-down environments, but we hit many issues that made the experience bad and slowed us down:
     
     1.  Anthropic rate limit issues: Individuals can't easily get Anthropic API keys with high enough [rate limits](https://docs.anthropic.com/en/api/rate-limits#rate-limits) to actually use Amp. (Anthropic is understandably strict here unless you are an enterprise customer of theirs.)
     2.  LLM proxy and connectivity issues: Many people tried to use Isolated Mode with custom LLM proxies that weren't fully API-compatible with Anthropic's API, which led to hard-to-debug issues.
     3.  Gemini API parity issues: We found that Gemini 2.5 Pro only works well via Google Cloud Vertex AI (a more enterprise-y offering) rather than Google AI Studio, which is how most people would generate API keys, because of differences in how they handle thinking.
     
     Even though we _could_ work around these specific issues, more will arise in the future because tool-calling agents need to [integrate more deeply into model capabilities](/fif#model-selector) and LLM APIs are getting more complex and differentiated.
     
     We believe the best product is built by iterating fast at the model↔product frontier, and most devs and companies want the best coding agent _more_ than they want a worse coding agent that satisfies other constraints.
     
     _If you were using Isolated Mode_: When you update Amp in VS Code, you'll see a message informing you of this change and requiring you to disable Isolated Mode to continue. Your threads are preserved locally.
     
56.  May 7, 2025
     
     ### [AGENT.md](/news/AGENT.md)
     
     _Update: Amp now looks in files named `AGENTS.md` (with an `S`)._
     
     Amp now looks in the `AGENT.md` file at the root of your project for guidance on project structure, build & test steps, conventions, and avoiding common mistakes. [Manual »](/manual#AGENTS.md)
     
     Amp will offer to generate this file by reading your project and other agents' files (`.cursorrules`, `.cursor/rules`, `.windsurfrules`, `.clinerules`, `CLAUDE.md`, and `.github/copilot-instructions.md`).
     
     We chose `AGENT.md` as a naming standard to avoid the proliferation of agent-specific files in your repositories. We [hope](https://x.com/sqs/status/1920029114125201570) other agents will follow this convention.
     
57.  May 7, 2025
     
     ### [File Mentions in CLI](/news/cli-file-mentions)
     
     The [Amp CLI](https://www.npmjs.com/package/@sourcegraph/amp) now supports file mentions in interactive mode. Type `@` followed by a pattern to fuzzy-search. Use Tab or Shift-Tab through the results, and hit Enter to confirm.
     
58.  April 22, 2025
     
     ### [Manual](/manual)
     
     An operator's guide to Amp
     
59.  April 15, 2025
     
     ### [How to Build an Agent](/how-to-build-an-agent)
     
     It’s not that hard to build a fully functioning, code-editing agent.
     
60.  April 9, 2025
     
     ### [Frequently Ignored Feedback](/fif)
     
     Our responses to some common feedback that we are intentionally not acting on.
     
61.  April 4, 2025
     
     ### [Raising an Agent, Episode 4](/podcast)
     
     What will AI do to open-source? What does it mean for GitHub? What does it mean for interviewing engineers?
     
62.  March 28, 2025
     
     ### [Raising an Agent, Episode 3](/podcast)
     
     What does this all mean for code search? How do you balance coding knowledge/skills/experience vs. letting the AI do it?
     
63.  March 13, 2025
     
     ### [Raising an Agent, Episode 2](/podcast)
     
     Is the magic with these agents that there are no token limits? Where do the agents fail? Do they need guidance? Where? How does one even price this? Isn't it too expensive?
     
64.  March 6, 2025
     
     ### [Raising an Agent, Episode 1](/podcast)
     
     Thorsten and Quinn start building Amp.