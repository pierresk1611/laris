import { Dropbox } from 'dropbox';

const token = "sl.u.AGRp1zqKiGGHUHyrZJPA3EG_k_GXq_uL3CGoLpRDGG2eZP3wuk-7piZNoAwJdNApVkyyWh32FVXA5kgS-UX_Ud4qMSROKwzR-_mbjevzAtgzu2sSQ2Csjv06gbfSk7iJbf-ggS08iovPTDZJeeMMWYfkOcL6tFt4eGm3CHTqADUlN1IX7Ox6kBVxkU88c077RQNT65dbio-jyulnFpukNglopxdQdMgtV95-FKi-Fkhcm1o9ztjopETRdfQcnUPQSx-YRz3s2RN1frUxvFpsfWt1h3-emMBlbDXB6kd6G8ftQZAoC0qNTHp7OGX5ZT4FWSmHIbAqTt1dHMB_25szHhNHJK5BmJMdOo4fufw7y3ZlVCa6_tQhuVMTprVbbocFJ3RY-_iGvCw7Rym0GWgpwapgpUlcRBnaZTmx2aiwgwzLblraKPH9FXrL9EmpHDLOI1BLYcvyt7NjHHuBRBUDGD6cHpgLpY-hRgnoX5DW2S4fEaAMi-q4n7uyhdO8Yqk8WVFBYJ4Fv0VKbBhZqonmaBQzgYSkcRo5vXswjonxtHoMYexaykOUP9BmVc9pFT-zSql2Q-5e-tiWGPYMa3mztbSdeACucAxN2LjCctSCwLimCUfNGwI0P7nao5kfhMyB2neem6V9xA_J5NLg9TSCd0uvM8ZDZM-qfzkRzu2uSSZ5qVQfIU-ClB_TPGXQ8nDxf73HZOl5KQKnsRDmai8mW2pOYit7C3ZQrZ4Lj6kyUd6UKI7JpiCNPdE7NyJn5aMuA5FZoCvvjnxmGA1s85KvKSfgGM0wRr3VdNYuNH8BcKU12QFYTXnHhAA19AB4W_A7mYssBH9oWl7w-MnXMMxyUrnWlX-eBP00EWeKIazjoAVddTeu2ErMhW8dN7e2WkmYG_y7LMYxaWROc65Dl3n0fsiopEhnyv5xeK2QOhZSZsUz674ieMEcAQGkGR77DLkytke8S8z1yaoBQLKw8CqGPJgWx9sl4HFowbzsoec4tf0xYp3TeRBqSpGU6fJqp1V__RnEJTllic6d5djCLonJUX0WwEXhUYlB9eSFM6nYNoHfwY36EpiEKRaYc4w3wxcuaWtRvYJwM8p_-qw6WNcnWAGmwWZ5EqEZP-c_1y5XImOQdw__z4T2Sdowzz-Lo3fpGCBrzU2By0XuL1OBI6gVF8KMHF-pknmFQWa8EYmDuxssJ5qCzdpccdoHOeBDTpnlqbxo9e-lyhT7DRy803jp1KSA88z0vWH2bpvzjYK0jo3PaIMihsyyUaNrk-2SsO9WmFJuU5X8KP5T93YYYXEbBuJU";

async function testDropbox() {
    console.log("Testing Dropbox connection...");
    const dbx = new Dropbox({ accessToken: token });

    try {
        console.log("Listing /TEMPLATES...");
        const response = await dbx.filesListFolder({ path: '/TEMPLATES' });
        console.log("SUCCESS! Found entries:", response.result.entries.length);
        console.log("Entries:", response.result.entries.map(e => e.name));
    } catch (err: any) {
        console.error("DROPBOX TEST FAILED!");
        console.error("Status:", err.status);
        console.error("Error Summary:", err.error?.error_summary);
        console.error("Details:", JSON.stringify(err.error || err, null, 2));
    }
}

testDropbox();
