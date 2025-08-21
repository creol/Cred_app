const Config = require('../src/utils/config');
const Database = require('../src/database/database');

(async () => {
	const config = new Config();
	const db = new Database(config);

	await db.initialize();

	const templates = await db.getAllTemplates();
	const toDelete = templates.filter(t => t.name !== 'My name is');
	const toKeep = templates.filter(t => t.name === 'My name is');

	for (const t of toDelete) {
		await db.deleteTemplate(t.id);
		console.log(`Deleted: ${t.name} (${t.id})`);
	}

	console.log(`Summary -> kept: ${toKeep.length}, deleted: ${toDelete.length}`);

	await db.close();
})().catch(err => {
	console.error('Error deleting templates:', err);
	process.exit(1);
});


