let els = document.querySelectorAll('.source-code')

for(let el of els){
    let text = el.innerHTML

    // let fix the source code
    let lines = text.split("\n");
    let rows  = [];
    let tabSize = 1000;

    for(let i=0; i<lines.length; i++){
        let line = lines[i];


        // - remove empty first and last line.
        if(!i || i == (lines.length - 1)){
            if(!line.trim())
                continue;
        }

        // - find the correct tab size
        line = line.replace(/ +$/, '');
        if(line){
            let prefSpace = line.length - ( line.trim() ).length;
            if(prefSpace < tabSize)
                tabSize = prefSpace;
        }
        
        rows.push(line);
    }

    // - trim all rows by the shortest tab size
    for(let i=0; i<rows.length; i++)
        rows[i] = rows[i].substr(tabSize)

    text = rows.join("\n");

    let parent = el.parentNode;
    let pre = document.createElement('pre');
    let code = document.createElement('code');
    code.classList.add('language-' + el.dataset.hl);
    pre.appendChild(code);
    parent.appendChild(pre);

    text = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    code.innerHTML = text;

    Prism.highlightElement(code);
}