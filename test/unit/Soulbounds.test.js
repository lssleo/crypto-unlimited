const { assert, expect } = require('chai')
const { ethers } = require('hardhat')

const { AddressZero } = ethers.constants
const URI = 'http://uri'
const BASICNFTURI = 'BasicNftUri'
const RARENFTURI = 'RareNftUri'
const SUPERRARENFTURI = 'SuperRareNftUri'
const SALESSBTURI = 'SalesSbtUri'
const RARESBTURI = 'RareSbtUri'
const SUPERSBTURI = 'SuperSecretSbtUri'
const REGISTRY_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('REGISTRY_ROLE'))
const MARKETPLACE_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MARKETPLACE_ROLE'))
const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'))
const SOULBOUNDS_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('SOULBOUNDS_ROLE'))
const randomAddress = ethers.utils.hexlify(ethers.utils.randomBytes(20))
const minterPrice = ethers.utils.parseEther('0.1')
const nftPrice = ethers.utils.parseEther('0.5')

let accounts,
    owner,
    registryRole,
    marketplaceRole,
    minterRole,
    sbtRole,
    anyone,
    user1,
    user2,
    control,
    registry,
    marketplace,
    minter,
    soulbounds,
    holder,
    random,
    VRFMock

describe('Soulbounds', async () => {
    beforeEach(async () => {
        accounts = await ethers.getSigners()
        owner = accounts[0]
        registryRole = accounts[1]
        marketplaceRole = accounts[2]
        minterRole = accounts[3]
        sbtRole = accounts[4]
        anyone = accounts[5]
        user1 = accounts[6]
        user2 = accounts[7]

        ControlContract = await ethers.getContractFactory('Control')
        control = await ControlContract.deploy(
            registryRole.address,
            marketplaceRole.address,
            minterRole.address,
            sbtRole.address
        )
        await control.deployed()

        const RegistryContract = await ethers.getContractFactory('Registry')
        registry = await RegistryContract.deploy()
        await registry.deployed()

        const MarketplaceContract = await ethers.getContractFactory('Marketplace')
        marketplace = await MarketplaceContract.deploy(control.address, registry.address)
        await marketplace.deployed()

        const MinterContract = await ethers.getContractFactory('Minter')
        minter = await MinterContract.deploy(control.address, registry.address)
        await minter.deployed()

        const SoulboundsContract = await ethers.getContractFactory('Soulbounds')
        soulbounds = await SoulboundsContract.deploy(
            control.address,
            registry.address,
            SALESSBTURI,
            RARESBTURI,
            SUPERSBTURI
        )
        await soulbounds.deployed()

        const HolderContract = await ethers.getContractFactory('Holder')
        holder = await HolderContract.deploy([owner.address], ['100'])
        await holder.deployed()

        const VRFCoordinatorMock = await ethers.getContractFactory('VRFCoordinatorV2Mock')
        VRFMock = await VRFCoordinatorMock.deploy('100000000000000000', '1000000000')
        await VRFMock.createSubscription()
        await VRFMock.fundSubscription('1', ethers.utils.parseEther('1'))

        RandomContract = await ethers.getContractFactory('Random')
        random = await RandomContract.deploy(registry.address, VRFMock.address, [
            BASICNFTURI,
            RARENFTURI,
            SUPERRARENFTURI,
        ])
        await random.deployed()

        await VRFMock.addConsumer('1', random.address)

        await control.connect(registryRole).setRegistry(registry.address)
        await registry.setMinterContract(minter.address)
        await registry.setMarketplaceContract(marketplace.address)
        await registry.setRandomContract(random.address)
        await registry.setSoulboundsContract(soulbounds.address)
        await registry.setHolderAddress(holder.address)
        await registry.setOracleParams(
            '1',
            '0x4b09e658ed251bcafeebbc69400383d49f344ace09b9576fe248bb02c003fe9f',
            '500000'
        )
        await control.connect(minterRole).setPriceMinter(minterPrice)
        await control.connect(minterRole).activateMinter()
    })

    it('Reverts if not marketplace contract try mint sales soulbound', async () => {
        await expect(soulbounds.connect(owner).salesAchievement(randomAddress)).to.be.revertedWith(
            'Soulbounds: Caller is not marketplace'
        )
        await expect(soulbounds.connect(anyone).salesAchievement(randomAddress)).to.be.revertedWith(
            'Soulbounds: Caller is not marketplace'
        )
        await expect(
            soulbounds.connect(sbtRole).salesAchievement(randomAddress)
        ).to.be.revertedWith('Soulbounds: Caller is not marketplace')
        await expect(
            soulbounds.connect(marketplaceRole).salesAchievement(randomAddress)
        ).to.be.revertedWith('Soulbounds: Caller is not marketplace')
    })
    it('Reverts if not random contract try mint rare soulbound', async () => {
        await expect(soulbounds.connect(owner).rareAchievement(randomAddress)).to.be.revertedWith(
            'Soulbounds: Callet is not random'
        )
        await expect(soulbounds.connect(anyone).rareAchievement(randomAddress)).to.be.revertedWith(
            'Soulbounds: Callet is not random'
        )
        await expect(soulbounds.connect(sbtRole).rareAchievement(randomAddress)).to.be.revertedWith(
            'Soulbounds: Callet is not random'
        )
        await expect(
            soulbounds.connect(marketplaceRole).rareAchievement(randomAddress)
        ).to.be.revertedWith('Soulbounds: Callet is not random')
    })
    it('Super achievement reverts if signature invalid,available only once, if success mint sbt and emits event', async () => {
        const msgHash = ethers.utils.keccak256(
            ethers.utils.solidityPack(['address'], [anyone.address])
        )
        const msgHashBin = ethers.utils.arrayify(msgHash)
        const ownerSignature = await owner.signMessage(msgHashBin)
        const invalidSignature = await user1.signMessage(msgHashBin)

        await expect(
            soulbounds.connect(anyone).superAchievement(anyone.address, invalidSignature)
        ).to.be.revertedWith('Soulbounds: Signature not valid')

        expect(
            await soulbounds.connect(anyone).superAchievement(anyone.address, ownerSignature)
        ).to.emit('SuperAchievementMinted')

        assert.equal(await soulbounds.balanceOf(anyone.address, '2'), '1')
        await expect(
            soulbounds.connect(anyone).superAchievement(anyone.address, ownerSignature)
        ).to.be.revertedWith('Soulbounds: Super achievement available only once')
    })

    it('Reverts if not control contract try mint soulbounds', async () => {
        await expect(
            soulbounds.connect(anyone).mint(anyone.address, '2', '100')
        ).to.be.revertedWith('Soulbounds: Caller is not control contract')
        await expect(
            soulbounds.connect(sbtRole).mint(anyone.address, '2', '100')
        ).to.be.revertedWith('Soulbounds: Caller is not control contract')
        await expect(
            soulbounds.connect(marketplaceRole).mint(anyone.address, '2', '100')
        ).to.be.revertedWith('Soulbounds: Caller is not control contract')
        await expect(
            soulbounds.connect(registryRole).mint(anyone.address, '2', '100')
        ).to.be.revertedWith('Soulbounds: Caller is not control contract')
    })
    it('Reverts if not control contract try set token', async () => {
        await expect(
            soulbounds.connect(anyone).setToken('10', RARESBTURI, true)
        ).to.be.revertedWith('Soulbounds: Caller is not control contract')
        await expect(
            soulbounds.connect(sbtRole).setToken('10', RARESBTURI, true)
        ).to.be.revertedWith('Soulbounds: Caller is not control contract')
        await expect(
            soulbounds.connect(marketplaceRole).setToken('10', RARESBTURI, true)
        ).to.be.revertedWith('Soulbounds: Caller is not control contract')
        await expect(
            soulbounds.connect(registryRole).setToken('10', RARESBTURI, true)
        ).to.be.revertedWith('Soulbounds: Caller is not control contract')
    })

    it('Reverts if try set tokens that already initialized', async () => {
        await expect(
            control.connect(sbtRole).setSoulboundToken('1', RARESBTURI, true)
        ).to.be.revertedWith('Soulbounds: Already initialized')
        await expect(
            control.connect(sbtRole).setSoulboundToken('0', RARESBTURI, true)
        ).to.be.revertedWith('Soulbounds: Already initialized')
        await expect(
            control.connect(sbtRole).setSoulboundToken('2', RARESBTURI, true)
        ).to.be.revertedWith('Soulbounds: Already initialized')
        await control.connect(sbtRole).setSoulboundToken('100', SALESSBTURI, true)
        await expect(
            control.connect(sbtRole).setSoulboundToken('100', SALESSBTURI, true)
        ).to.be.revertedWith('Soulbounds: Already initialized')
    })
    it('Supports interface', async () => {
        assert.equal(await soulbounds.supportsInterface('0x911ec470'), true)
        assert.equal(await soulbounds.supportsInterface('0xd9b67a26'), true)
    })
    it('Soulbounds non transferable', async () => {
        await control.connect(sbtRole).mintSoulbounds(anyone.address, '1', '100')
        await expect(
            soulbounds
                .connect(anyone)
                .safeTransferFrom(anyone.address, owner.address, '1', '10', '0x00')
        ).to.be.revertedWith('ERC5633: Soulbound, Non-Transferable')
    })
})
