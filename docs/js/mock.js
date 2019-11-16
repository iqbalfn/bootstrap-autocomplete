$.get = function(url, cb){
    let target = new URL(url)
    let search = target.search.replace(/^\?/, '');
    let queries= search.split('&');
    let cond   = {}

    queries.forEach(x => {
        let y = x.split('=')
        cond[y[0]] = (y[1] || y[0]).toLowerCase();
    })

    console.log('Mocking request: ' + url)

    let result = []
    window.TIMEZONES.forEach(x => {
        if(cond.group){
            let names = x.split('/')
            if(names[0].toLowerCase() != cond.group)
                return;
        }

        if(cond.q && !x.toLowerCase().includes(cond.q))
            return;

        result.push(x)
    })
    cb(result)
}