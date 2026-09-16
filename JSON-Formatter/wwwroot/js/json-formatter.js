(() => {
    const initialJson = `{
  "name": "John Doe",
  "age": 30,
  "address": {
    "street": "123 Main St",
    "city": "Hyderabad",
    "zip": "500001"
  },
  "skills": [
    "React",
    "Node.js",
    "Python"
  ],
  "active": true,
  "score": null
}`;

    const input = document.getElementById('jsonInput');
    const tree = document.getElementById('jsonTree');
    const validationError = document.getElementById('validationError');
    const characterCount = document.getElementById('characterCount');
    const treeStatus = document.getElementById('treeStatus');
    const toast = document.getElementById('copyToast');
    const actionButtons = document.querySelectorAll('[data-action]');

    const endpointUrls = {
        validate: '/json-formatter/validate',
        beautify: '/json-formatter/beautify',
        minify: '/json-formatter/minify'
    };

    let validationTimer = null;
    let validationRequest = null;
    let validationSequence = 0;
    let toastTimer = null;
    const pendingClicks = new Map();

    function initialize() {
        input.value = initialJson;
        input.addEventListener('input', handleInput);
        actionButtons.forEach((button) => button.addEventListener('click', handleAction));
        tree.addEventListener('click', handleTreeClick);
        tree.addEventListener('dblclick', handleTreeDoubleClick);
        tree.addEventListener('keydown', handleTreeKeyDown);
        validateInput();
    }

    function handleInput() {
        updateCharacterCount();
        window.clearTimeout(validationTimer);
        validationTimer = window.setTimeout(validateInput, 180);
    }

    async function handleAction(event) {
        const action = event.currentTarget.dataset.action;
        if (action === 'clear') {
            clearAll();
            return;
        }

        const value = input.value;
        if (!value.trim()) {
            clearAll();
            return;
        }

        const button = event.currentTarget;
        button.disabled = true;
        try {
            const data = await postJson(endpointUrls[action], { input: value });
            if (data.isEmpty) {
                clearAll();
                return;
            }

            if (!data.success || !data.isValid) {
                showError(data.errorMessage || 'The JSON could not be processed.');
                tree.replaceChildren();
                treeStatus.textContent = 'Invalid JSON';
                return;
            }

            input.value = data.json ?? value;
            updateCharacterCount();
            renderParsedJson(data.json ?? value);
        } catch (error) {
            showError(getFriendlyError(error, 'The JSON could not be processed.'));
        } finally {
            button.disabled = false;
        }
    }

    async function validateInput() {
        const value = input.value;
        updateCharacterCount();

        if (!value.trim()) {
            clearValidationState();
            tree.replaceChildren();
            treeStatus.textContent = 'Waiting for JSON';
            return;
        }

        const sequence = ++validationSequence;
        if (validationRequest) {
            validationRequest.abort();
        }
        validationRequest = new AbortController();
        showError('');

        try {
            const data = await postJson(endpointUrls.validate, { input: value }, validationRequest.signal);
            if (sequence !== validationSequence) {
                return;
            }

            if (data.isEmpty) {
                clearValidationState();
                tree.replaceChildren();
                treeStatus.textContent = 'Waiting for JSON';
                return;
            }

            if (!data.success || !data.isValid) {
                showError(data.errorMessage || 'The JSON is invalid.');
                tree.replaceChildren();
                treeStatus.textContent = 'Invalid JSON';
                return;
            }

            renderParsedJson(data.json ?? value);
        } catch (error) {
            if (sequence !== validationSequence || isAbortError(error)) {
                return;
            }
            showError(getFriendlyError(error, 'Unable to validate the JSON. Please try again.'));
            tree.replaceChildren();
            treeStatus.textContent = 'Validation unavailable';
        }
    }

    function renderParsedJson(jsonText) {
        let parsed;
        try {
            parsed = JSON.parse(jsonText);
        } catch (error) {
            showError(`The server returned JSON that could not be rendered: ${error.message}`);
            tree.replaceChildren();
            treeStatus.textContent = 'Render error';
            return;
        }

        tree.replaceChildren();
        const rootNode = buildNode(parsed, null);
        const rootElement = createNodeElement(rootNode);
        tree.appendChild(rootElement.wrapper);
        treeStatus.textContent = getTreeStatus(parsed);
    }

    function buildNode(value, key) {
        const root = createEmptyNode(value, key);
        const stack = [{ value, node: root }];

        while (stack.length > 0) {
            const current = stack.pop();
            if (!current.node || (current.node.type !== 'object' && current.node.type !== 'array')) {
                continue;
            }

            const entries = current.node.type === 'array'
                ? current.node.value.map((childValue, index) => [String(index), childValue])
                : Object.entries(current.node.value);

            current.node.children = entries.map(([childKey, childValue]) => ({
                key: childKey,
                node: createEmptyNode(childValue, childKey)
            }));

            for (let index = entries.length - 1; index >= 0; index -= 1) {
                stack.push({
                    value: entries[index][1],
                    node: current.node.children[index].node
                });
            }
        }

        return root;
    }

    function createEmptyNode(value, key) {
        if (value === undefined) {
            return { type: 'undefined', value: undefined, key, children: null };
        }

        if (value === null) {
            return { type: 'null', value: null, key, children: null };
        }

        if (Array.isArray(value)) {
            return { type: 'array', value, key, children: null };
        }

        if (typeof value === 'object') {
            return { type: 'object', value, key, children: null };
        }

        if (typeof value === 'string') {
            return { type: 'string', value, key, children: null };
        }

        if (typeof value === 'number') {
            return { type: 'number', value, key, children: null };
        }

        return { type: 'boolean', value, key, children: null };
    }

    function createNodeElement(child) {
        const valueNode = child.node || child;
        const key = child.key !== undefined ? child.key : valueNode.key;
        const wrapper = document.createElement('div');
        wrapper.className = 'tree-node';
        const state = {
            node: valueNode,
            wrapper,
            row: null,
            childrenHost: null,
            closingRow: null,
            toggle: null,
            compactMarker: null
        };
        nodeElementStates.set(wrapper, state);

        if (valueNode.type === 'object' || valueNode.type === 'array') {
            const row = document.createElement('div');
            row.className = 'tree-row';
            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'tree-toggle';
            toggle.textContent = '▼';
            toggle.setAttribute('aria-label', valueNode.type === 'object' ? 'Collapse object' : 'Collapse array');
            const opening = createToken(valueNode.type === 'object' ? '{' : '[', 'tree-punctuation copy-target');
            opening.dataset.copy = serializeNode(valueNode);
            opening.setAttribute('aria-label', 'Copy JSON node');
            const compactMarker = document.createElement('span');
            compactMarker.className = 'compact-marker';
            compactMarker.hidden = true;
            compactMarker.textContent = valueNode.type === 'object' ? '{...}' : '[...]';
            if (key !== null) {
                row.prepend(createKeyElement(key, valueNode));
            }
            row.append(toggle, opening, compactMarker);

            const childrenHost = document.createElement('div');
            childrenHost.className = 'tree-children';

            for (const child of valueNode.children ?? []) {
                const childState = createNodeElement(child);
                childrenHost.appendChild(childState.wrapper);
            }

            const closingRow = document.createElement('div');
            closingRow.className = 'tree-closing-row';
            const closing = createToken(valueNode.type === 'object' ? '}' : ']', 'tree-punctuation copy-target');
            closing.dataset.copy = serializeNode(valueNode);
            closing.setAttribute('aria-label', 'Copy JSON node');
            closingRow.appendChild(closing);

            wrapper.append(row, childrenHost, closingRow);
            state.row = row;
            state.childrenHost = childrenHost;
            state.closingRow = closingRow;
            state.toggle = toggle;
            state.compactMarker = compactMarker;

            toggle.addEventListener('click', (event) => {
                event.stopPropagation();
                toggleNode(wrapper);
            });
        } else {
            const row = document.createElement('div');
            row.className = 'tree-row';
            if (key !== null) {
                row.appendChild(createKeyElement(key, valueNode));
            }
            row.appendChild(createValueElement(valueNode));
            wrapper.appendChild(row);
            state.row = row;
        }

        return state;
    }

    const nodeElementStates = new WeakMap();

    function createKeyElement(key, valueNode) {
        const keyElement = document.createElement('span');
        keyElement.className = 'tree-key copy-target copy-key';
        keyElement.textContent = key;
        keyElement.dataset.copy = serializeNode(valueNode);
        keyElement.dataset.pair = `${JSON.stringify(key)}: ${serializeNode(valueNode)}`;
        keyElement.tabIndex = 0;
        keyElement.setAttribute('role', 'button');
        keyElement.setAttribute('aria-label', `Copy value for ${key}`);
        return keyElement;
    }

    function createValueElement(node) {
        const valueElement = document.createElement('span');
        valueElement.className = `tree-value tree-value-${node.type} copy-target`;
        valueElement.textContent = serializePrimitive(node);
        valueElement.dataset.copy = serializeNode(node);
        valueElement.tabIndex = 0;
        valueElement.setAttribute('role', 'button');
        valueElement.setAttribute('aria-label', 'Copy JSON value');
        return valueElement;
    }

    function createToken(text, className) {
        const token = document.createElement('span');
        token.className = className;
        token.textContent = text;
        token.tabIndex = 0;
        return token;
    }

    function serializeNode(node) {
        if (node.value === undefined) {
            return "undefined";
        }
        return JSON.stringify(node.value);
    }

    function serializePrimitive(node) {
        if (node.type === 'string') {
            return JSON.stringify(node.value);
        }
        if (node.type === 'null') {
            return 'null';
        }
        if (node.type === 'undefined') {
            return 'undefined';
        }
        return String(node.value);
    }

    function toggleNode(wrapper) {
        const state = nodeElementStates.get(wrapper);
        if (!state) {
            return;
        }
        const collapsed = wrapper.classList.toggle('is-collapsed');
        state.toggle.textContent = collapsed ? '▶' : '▼';
        state.toggle.setAttribute('aria-label', `${collapsed ? 'Expand' : 'Collapse'} ${state.node.type}`);
        state.compactMarker.hidden = !collapsed;
        state.childrenHost.hidden = collapsed;
        state.closingRow.hidden = collapsed;
    }

    function handleTreeClick(event) {
        const target = getCopyTarget(event.target);
        if (!target || event.detail !== 1) {
            return;
        }

        window.clearTimeout(pendingClicks.get(target));
        pendingClicks.set(target, window.setTimeout(() => {
            pendingClicks.delete(target);
            const text = target.dataset.copy ?? '';
            copyText(text).then(() => showToast('Copied!'));
        }, 220));
    }

    function handleTreeDoubleClick(event) {
        const target = getCopyTarget(event.target);
        if (!target || !target.classList.contains('copy-key')) {
            return;
        }

        window.clearTimeout(pendingClicks.get(target));
        pendingClicks.delete(target);
        const text = target.dataset.pair ?? target.dataset.copy ?? '';
        copyText(text).then(() => showToast('Copied!'));
    }

    function handleTreeKeyDown(event) {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }
        const target = getCopyTarget(event.target);
        if (!target) {
            return;
        }
        event.preventDefault();
        const text = target.classList.contains('copy-key') && event.ctrlKey
            ? (target.dataset.pair ?? target.dataset.copy ?? '')
            : (target.dataset.copy ?? '');
        copyText(text).then(() => showToast('Copied!'));
    }

    function getCopyTarget(target) {
        return target instanceof Element ? target.closest('.copy-target') : null;
    }

    async function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return;
        }

        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.setAttribute('readonly', '');
        textArea.style.position = 'fixed';
        textArea.style.top = '-1000px';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
    }

    function showToast(message) {
        toast.textContent = message;
        toast.hidden = false;
        toast.classList.add('is-visible');
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => {
            toast.classList.remove('is-visible');
            window.setTimeout(() => {
                toast.hidden = true;
            }, 180);
        }, 1300);
    }

    function showError(message) {
        validationError.textContent = message || '';
        validationError.hidden = !message;
    }

    function clearValidationState() {
        showError('');
    }

    function clearAll() {
        window.clearTimeout(validationTimer);
        validationSequence += 1;
        if (validationRequest) {
            validationRequest.abort();
            validationRequest = null;
        }
        pendingClicks.forEach((timer) => window.clearTimeout(timer));
        pendingClicks.clear();
        input.value = '';
        updateCharacterCount();
        clearValidationState();
        tree.replaceChildren();
        treeStatus.textContent = 'Waiting for JSON';
        input.focus();
    }

    function updateCharacterCount() {
        const count = input.value.length;
        characterCount.textContent = `${count.toLocaleString()} ${count === 1 ? 'character' : 'characters'}`;
    }

    function getTreeStatus(value) {
        if (Array.isArray(value)) {
            return `${value.length} ${value.length === 1 ? 'item' : 'items'}`;
        }
        if (value !== null && typeof value === 'object') {
            const count = Object.keys(value).length;
            return `${count} ${count === 1 ? 'property' : 'properties'}`;
        }
        return 'Primitive value';
    }

    async function postJson(url, body, signal) {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body),
            signal
        });

        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}.`);
        }

        return await response.json();
    }

    function getFriendlyError(error, fallback) {
        if (isAbortError(error)) {
            return '';
        }
        return error && error.message ? error.message : fallback;
    }

    function isAbortError(error) {
        return error && error.name === 'AbortError';
    }

    initialize();
})();
